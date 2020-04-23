const { WPCampusRequestElement } = require("@wpcampus/wpcampus-wc-default");
const stylesheet = require("./index.css");

// Format options for displaying notifications.
const formatOptions = ["list", "listIcon"];
const formatDefault = "listIcon";

const loadingClass = "wpc-notifications--loading";
const listSelector = "wpc-notifications__list";

class WPCampusNotifications extends WPCampusRequestElement {
	constructor() {
		const config = {
			componentID: "notifications",
			localStorageKey: "wpcNotification",
			localStorageKeyTime: "wpcNotificationTime",
			requestURL: "https://wpcampus.org/wp-json/wpcampus/data/notifications"
		};
		super(config);

		this.addStyles(stylesheet);

		if (this.dataset.format !== undefined) {
			this.format = this.dataset.format;
		}
		if (!formatOptions.includes(this.format)) {
			this.format = formatDefault;
		}
	}
	getTemplate(content) {
		let template = "";
		let notificationClass = "wpc-notification";

		// Add the icon.
		if ("listIcon" === this.format) {
			notificationClass += " wpc-notification--icon";
			template += `<div class="wpc-notification__icon">
			<?xml version="1.0" encoding="utf-8"?>
			<svg aria-hidden="true" role="decoration" class="wpc-notification__icon__graphic" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" viewBox="0 0 30 30" style="enable-background:new 0 0 30 30;" xml:space="preserve">
			  <title></title>
			  <style type="text/css">.wpc-notification__icon__i--white{fill:#FFFFFF;}</style>
			  <circle class="wpc-notification__icon__bg" cx="15" cy="15" r="15" />
			  <circle class="wpc-notification__icon__i wpc-notification__icon__i--dot wpc-notification__icon__i--white" cx="15" cy="8.2" r="2.4" />
			  <g>
				<path class="wpc-notification__icon__i wpc-notification__icon__i--body wpc-notification__icon__i--white" d="M12.6,23.1c0,0.3,0.3,0.6,0.6,0.6h3.6c0.3,0,0.6-0.3,0.6-0.6v-9.6c0-0.3-0.3-0.6-0.6-0.6h-3.6c-0.3,0-0.6,0.3-0.6,0.6V23.1z" />
			  </g>
			</svg>
		  </div>`;
		}

		// Add message.
		template += "<div class=\"wpc-notification__message\"></div>";

		// Wrap in <li>.
		template = `<li class="${notificationClass}">` + template + "</li>";

		const templateDiv = document.createElement("div");
		templateDiv.innerHTML = template;

		if (content) {
			templateDiv.querySelector(".wpc-notification__message").innerHTML = content;
		}

		return templateDiv.innerHTML;
	}
	getHTMLMarkup(content, loading) {
		const templateDiv = document.createElement("div");

		let markup = `<ul class="${listSelector}">${content}</ul>`;
		markup = this.wrapTemplateArea(markup);
		markup = this.wrapTemplate(markup, true);

		templateDiv.innerHTML = markup;

		if (true === loading) {
			templateDiv
				.querySelector(this.getWrapperSelector())
				.classList.add(loadingClass);
		}

		return templateDiv.innerHTML;
	}
	async loadContentError() {

		const content = "<p class=\"wpc-component__error-message\">There was a problem loading the notification.";

		const cssPrefix = this.getComponentCSSPrefix();
		this.classList.add(`${cssPrefix}--error`);

		this.innerHTML = this.getHTMLMarkup(content);

		return true;
	}
	loadContentHTML(content, loading) {
		const that = this;
		return new Promise((resolve, reject) => {
			if (!content || !content.length) {
				reject("There is no content to display.");
			}

			// Build new template.
			let newContent = "";

			// Get our limit of content.
			let contentLimit;
			if (that.limit !== undefined && that.limit > 0) {
				contentLimit = that.limit;
			} else {
				contentLimit = content.length;
			}

			for (let i = 0; i < contentLimit; i++) {
				let item = content[i];

				// Get new message.
				let newMessage = item ? item.content.rendered : null;

				if (!newMessage) {
					continue;
				}

				// Strip parent <p>.
				const newMessageDiv = document.createElement("div");
				newMessageDiv.innerHTML = newMessage;
				newMessage = newMessageDiv.querySelector("*:first-child").innerHTML;

				// Add to the rest of the messages.
				newContent += that.getTemplate(newMessage);

			}

			if (!newContent) {
				return resolve(false);
			}

			// Wrap in global templates.
			// Only set loading if innerHTML is empty to begin with.
			let markup = that.getHTMLMarkup(newContent, loading && !that.innerHTML);

			if (!that.innerHTML) {

				// Load the markup.
				that.innerHTML = markup;

				if (true === loading) {
					setTimeout(() => {
						that
							.querySelector(that.getWrapperSelector())
							.classList.remove(loadingClass);
					}, 200);
				}

				return resolve(true);
			}

			// Get out of here if no message or the message is the same.
			let existingContent = that.querySelector(`.${listSelector}`);
			if (newContent === existingContent.innerHTML) {
				return resolve(true);
			}

			// Get component wrapper.
			var componentDiv = that.querySelector(that.getWrapperSelector());

			that.fadeOut(componentDiv).then(() => {
				that.innerHTML = markup;
				that.fadeIn(componentDiv).then(() => {
					return resolve(true);
				});
			});
		});
	}
	async loadContentFromRequest() {
		const that = this;

		// Limit the number of requests we make. Can be reset by user activity.
		that.requestUpdateCount++;
		that.requestUpdateMax = that.checkPropertyNumber(
			that.requestUpdateMax,
			that.requestUpdateMaxDefault,
			true
		);

		if (that.requestUpdateCount > that.requestUpdateMax) {
			that.pauseTimer();
			return;
		}

		that.requestContent()
			.then((response) => {
				try {
					if (!response) {
						throw "The request had no response.";
					}

					// Convert string to object.
					const content = JSON.parse(response);

					that.loadContentHTML(content, true)
						.then((loaded) => {

							// This means the content was changed/updated.
							if (true === loaded) {
								that.storeLocalContent(content);
							}
						})
						.catch(() => {
							// @TODO what to do when the request doesn't work?
						});
				} catch (error) {
					// @TODO handle error
				}
			})
			.catch(() => {

				// If request didnt work, force load local content.
				that.loadContentFromLocal(true);
			})
			.finally(() => {
				that.setUpdateTimer();
			});
	}
	async render() {
		const that = this;
		super.render().then(() => {

			that.isRendering(true);

			that.setAttribute("role", "complementary");
			that.setAttribute("aria-live", "polite");
			that.setAttribute("aria-label", "Most recent WPCampus announcement");

			that.loadContent().then(() => {
				that.isRendering(false);
			});
		});
	}
	connectedCallback() {
		super.connectedCallback();
		this.render();
	}
}
customElements.define("wpcampus-notifications", WPCampusNotifications);

module.exports = WPCampusNotifications;
