import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js"


// Load Image With Subfolder
app.registerExtension({
	name: "LoadImageWithSubfolder",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "LoadImageWithSubfolder") {
			if (nodeData?.input?.required?.image?.[1]?.image_upload === true) {
				nodeData.input.required.upload = ["IMAGELOADER"];
			}
		}
	},

	async getCustomWidgets(app) {
		return {
			IMAGELOADER(node, inputName, inputData, app) {
				const subfolderWidget = node.widgets.find((w) => w.name === (inputData[1]?.widget ?? "subfolder"));
				const imageWidget = node.widgets.find((w) => w.name === (inputData[1]?.widget ?? "image"));
				let uploadWidget;
		
				function showImage(name) {
					const img = new Image();
					img.onload = () => {
						node.imgs = [img];
						app.graph.setDirtyCanvas(true);
					};

					if (name) {
						let subfolder = subfolderWidget.value ?? "";
						img.src = api.apiURL(`/view?filename=${encodeURIComponent(name)}&type=input&subfolder=${subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`);
						node.setSizeForImage?.();
					}
					else {
						node.imgs = [];
						app.graph.setDirtyCanvas(true);
					}
				}

				async function getImages(subfolder) {
					const resp = await api.fetchApi("/images_in_directory", {
						method: "POST",
						body: JSON.stringify({
							filetype: "input",
							subfolder: subfolder
						})
					});

					if (resp.status === 200) {
						const data = await resp.json();
						imageWidget.options.values = []
						for (const name of data.images) {
							imageWidget.options.values.push(name);
						}
						if (imageWidget.options.values.length > 0) {
							imageWidget.value = imageWidget.options.values[0];
						}
						else {
							imageWidget.value = undefined;
						}
						showImage(imageWidget.value);
					}
				}

				getImages(subfolderWidget.value ?? "");

				const cb = node.callback;
				imageWidget.callback = function () {
					showImage(imageWidget.value);
					if (cb) {
						return cb.apply(this, arguments);
					}
				};

				subfolderWidget.callback = function () {
					getImages(subfolderWidget.value ?? "")
					if (cb) {
						return cb.apply(this, arguments);
					}
				}

				// On load if we have a value then render the image
				// The value isnt set immediately so we need to wait a moment
				// No change callbacks seem to be fired on initial setting of the value
				requestAnimationFrame(() => {
					if (imageWidget.value) {
						showImage(imageWidget.value);
					}
				});

				async function uploadFile(file, updateNode) {
					try {
						// Wrap file in formdata so it includes filename
						const body = new FormData();
						body.append("image", file);
						if (subfolderWidget.value) body.append("subfolder", subfolderWidget.value);
						const resp = await api.fetchApi("/upload/image", {
							method: "POST",
							body,
						});

						if (resp.status === 200) {
							const data = await resp.json();
							// Add the file to the dropdown list and update the widget value
							let path = data.name;		
							if (!imageWidget.options.values.includes(path)) {
								imageWidget.options.values.push(path);
							}

							if (updateNode) {
								showImage(path);
								imageWidget.value = path;
							}
						} else {
							alert(resp.status + " - " + resp.statusText);
						}
					} catch (error) {
						alert(error);
					}
				}

				const fileInput = document.createElement("input");
				Object.assign(fileInput, {
					type: "file",
					accept: "image/jpeg,image/png,image/webp",
					style: "display: none",
					onchange: async () => {
						if (fileInput.files.length) {
							await uploadFile(fileInput.files[0], true);
						}
					},
				});
				document.body.append(fileInput);

				// Create the button widget for selecting the files
				uploadWidget = node.addWidget("button", inputName, "image", () => {
					fileInput.click();
				});
				uploadWidget.label = "choose file to upload";
				uploadWidget.serialize = false;

				return { widget: uploadWidget };
			}
		}
	},
});
