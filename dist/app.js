/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@capacitor/camera/dist/esm/definitions.js":
/*!****************************************************************!*\
  !*** ./node_modules/@capacitor/camera/dist/esm/definitions.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   CameraDirection: () => (/* binding */ CameraDirection),\n/* harmony export */   CameraResultType: () => (/* binding */ CameraResultType),\n/* harmony export */   CameraSource: () => (/* binding */ CameraSource)\n/* harmony export */ });\nvar CameraSource;\n(function (CameraSource) {\n    /**\n     * Prompts the user to select either the photo album or take a photo.\n     */\n    CameraSource[\"Prompt\"] = \"PROMPT\";\n    /**\n     * Take a new photo using the camera.\n     */\n    CameraSource[\"Camera\"] = \"CAMERA\";\n    /**\n     * Pick an existing photo from the gallery or photo album.\n     */\n    CameraSource[\"Photos\"] = \"PHOTOS\";\n})(CameraSource || (CameraSource = {}));\nvar CameraDirection;\n(function (CameraDirection) {\n    CameraDirection[\"Rear\"] = \"REAR\";\n    CameraDirection[\"Front\"] = \"FRONT\";\n})(CameraDirection || (CameraDirection = {}));\nvar CameraResultType;\n(function (CameraResultType) {\n    CameraResultType[\"Uri\"] = \"uri\";\n    CameraResultType[\"Base64\"] = \"base64\";\n    CameraResultType[\"DataUrl\"] = \"dataUrl\";\n})(CameraResultType || (CameraResultType = {}));\n//# sourceMappingURL=definitions.js.map\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/camera/dist/esm/definitions.js?");

/***/ }),

/***/ "./node_modules/@capacitor/camera/dist/esm/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/@capacitor/camera/dist/esm/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Camera: () => (/* binding */ Camera),\n/* harmony export */   CameraDirection: () => (/* reexport safe */ _definitions__WEBPACK_IMPORTED_MODULE_2__.CameraDirection),\n/* harmony export */   CameraResultType: () => (/* reexport safe */ _definitions__WEBPACK_IMPORTED_MODULE_2__.CameraResultType),\n/* harmony export */   CameraSource: () => (/* reexport safe */ _definitions__WEBPACK_IMPORTED_MODULE_2__.CameraSource)\n/* harmony export */ });\n/* harmony import */ var _capacitor_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @capacitor/core */ \"./node_modules/@capacitor/core/dist/index.js\");\n/* harmony import */ var _web__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./web */ \"./node_modules/@capacitor/camera/dist/esm/web.js\");\n/* harmony import */ var _definitions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./definitions */ \"./node_modules/@capacitor/camera/dist/esm/definitions.js\");\n\n\nconst Camera = (0,_capacitor_core__WEBPACK_IMPORTED_MODULE_0__.registerPlugin)('Camera', {\n    web: () => new _web__WEBPACK_IMPORTED_MODULE_1__.CameraWeb(),\n});\n\n\n//# sourceMappingURL=index.js.map\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/camera/dist/esm/index.js?");

/***/ }),

/***/ "./node_modules/@capacitor/camera/dist/esm/web.js":
/*!********************************************************!*\
  !*** ./node_modules/@capacitor/camera/dist/esm/web.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Camera: () => (/* binding */ Camera),\n/* harmony export */   CameraWeb: () => (/* binding */ CameraWeb)\n/* harmony export */ });\n/* harmony import */ var _capacitor_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @capacitor/core */ \"./node_modules/@capacitor/core/dist/index.js\");\n/* harmony import */ var _definitions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./definitions */ \"./node_modules/@capacitor/camera/dist/esm/definitions.js\");\n\n\nclass CameraWeb extends _capacitor_core__WEBPACK_IMPORTED_MODULE_0__.WebPlugin {\n    async getPhoto(options) {\n        // eslint-disable-next-line no-async-promise-executor\n        return new Promise(async (resolve, reject) => {\n            if (options.webUseInput || options.source === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraSource.Photos) {\n                this.fileInputExperience(options, resolve, reject);\n            }\n            else if (options.source === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraSource.Prompt) {\n                let actionSheet = document.querySelector('pwa-action-sheet');\n                if (!actionSheet) {\n                    actionSheet = document.createElement('pwa-action-sheet');\n                    document.body.appendChild(actionSheet);\n                }\n                actionSheet.header = options.promptLabelHeader || 'Photo';\n                actionSheet.cancelable = false;\n                actionSheet.options = [\n                    { title: options.promptLabelPhoto || 'From Photos' },\n                    { title: options.promptLabelPicture || 'Take Picture' },\n                ];\n                actionSheet.addEventListener('onSelection', async (e) => {\n                    const selection = e.detail;\n                    if (selection === 0) {\n                        this.fileInputExperience(options, resolve, reject);\n                    }\n                    else {\n                        this.cameraExperience(options, resolve, reject);\n                    }\n                });\n            }\n            else {\n                this.cameraExperience(options, resolve, reject);\n            }\n        });\n    }\n    async pickImages(_options) {\n        // eslint-disable-next-line no-async-promise-executor\n        return new Promise(async (resolve, reject) => {\n            this.multipleFileInputExperience(resolve, reject);\n        });\n    }\n    async cameraExperience(options, resolve, reject) {\n        if (customElements.get('pwa-camera-modal')) {\n            const cameraModal = document.createElement('pwa-camera-modal');\n            cameraModal.facingMode =\n                options.direction === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraDirection.Front ? 'user' : 'environment';\n            document.body.appendChild(cameraModal);\n            try {\n                await cameraModal.componentOnReady();\n                cameraModal.addEventListener('onPhoto', async (e) => {\n                    const photo = e.detail;\n                    if (photo === null) {\n                        reject(new _capacitor_core__WEBPACK_IMPORTED_MODULE_0__.CapacitorException('User cancelled photos app'));\n                    }\n                    else if (photo instanceof Error) {\n                        reject(photo);\n                    }\n                    else {\n                        resolve(await this._getCameraPhoto(photo, options));\n                    }\n                    cameraModal.dismiss();\n                    document.body.removeChild(cameraModal);\n                });\n                cameraModal.present();\n            }\n            catch (e) {\n                this.fileInputExperience(options, resolve, reject);\n            }\n        }\n        else {\n            console.error(`Unable to load PWA Element 'pwa-camera-modal'. See the docs: https://capacitorjs.com/docs/web/pwa-elements.`);\n            this.fileInputExperience(options, resolve, reject);\n        }\n    }\n    fileInputExperience(options, resolve, reject) {\n        let input = document.querySelector('#_capacitor-camera-input');\n        const cleanup = () => {\n            var _a;\n            (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);\n        };\n        if (!input) {\n            input = document.createElement('input');\n            input.id = '_capacitor-camera-input';\n            input.type = 'file';\n            input.hidden = true;\n            document.body.appendChild(input);\n            input.addEventListener('change', (_e) => {\n                const file = input.files[0];\n                let format = 'jpeg';\n                if (file.type === 'image/png') {\n                    format = 'png';\n                }\n                else if (file.type === 'image/gif') {\n                    format = 'gif';\n                }\n                if (options.resultType === 'dataUrl' ||\n                    options.resultType === 'base64') {\n                    const reader = new FileReader();\n                    reader.addEventListener('load', () => {\n                        if (options.resultType === 'dataUrl') {\n                            resolve({\n                                dataUrl: reader.result,\n                                format,\n                            });\n                        }\n                        else if (options.resultType === 'base64') {\n                            const b64 = reader.result.split(',')[1];\n                            resolve({\n                                base64String: b64,\n                                format,\n                            });\n                        }\n                        cleanup();\n                    });\n                    reader.readAsDataURL(file);\n                }\n                else {\n                    resolve({\n                        webPath: URL.createObjectURL(file),\n                        format: format,\n                    });\n                    cleanup();\n                }\n            });\n            input.addEventListener('cancel', (_e) => {\n                reject(new _capacitor_core__WEBPACK_IMPORTED_MODULE_0__.CapacitorException('User cancelled photos app'));\n                cleanup();\n            });\n        }\n        input.accept = 'image/*';\n        input.capture = true;\n        if (options.source === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraSource.Photos ||\n            options.source === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraSource.Prompt) {\n            input.removeAttribute('capture');\n        }\n        else if (options.direction === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraDirection.Front) {\n            input.capture = 'user';\n        }\n        else if (options.direction === _definitions__WEBPACK_IMPORTED_MODULE_1__.CameraDirection.Rear) {\n            input.capture = 'environment';\n        }\n        input.click();\n    }\n    multipleFileInputExperience(resolve, reject) {\n        let input = document.querySelector('#_capacitor-camera-input-multiple');\n        const cleanup = () => {\n            var _a;\n            (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);\n        };\n        if (!input) {\n            input = document.createElement('input');\n            input.id = '_capacitor-camera-input-multiple';\n            input.type = 'file';\n            input.hidden = true;\n            input.multiple = true;\n            document.body.appendChild(input);\n            input.addEventListener('change', (_e) => {\n                const photos = [];\n                // eslint-disable-next-line @typescript-eslint/prefer-for-of\n                for (let i = 0; i < input.files.length; i++) {\n                    const file = input.files[i];\n                    let format = 'jpeg';\n                    if (file.type === 'image/png') {\n                        format = 'png';\n                    }\n                    else if (file.type === 'image/gif') {\n                        format = 'gif';\n                    }\n                    photos.push({\n                        webPath: URL.createObjectURL(file),\n                        format: format,\n                    });\n                }\n                resolve({ photos });\n                cleanup();\n            });\n            input.addEventListener('cancel', (_e) => {\n                reject(new _capacitor_core__WEBPACK_IMPORTED_MODULE_0__.CapacitorException('User cancelled photos app'));\n                cleanup();\n            });\n        }\n        input.accept = 'image/*';\n        input.click();\n    }\n    _getCameraPhoto(photo, options) {\n        return new Promise((resolve, reject) => {\n            const reader = new FileReader();\n            const format = photo.type.split('/')[1];\n            if (options.resultType === 'uri') {\n                resolve({\n                    webPath: URL.createObjectURL(photo),\n                    format: format,\n                    saved: false,\n                });\n            }\n            else {\n                reader.readAsDataURL(photo);\n                reader.onloadend = () => {\n                    const r = reader.result;\n                    if (options.resultType === 'dataUrl') {\n                        resolve({\n                            dataUrl: r,\n                            format: format,\n                            saved: false,\n                        });\n                    }\n                    else {\n                        resolve({\n                            base64String: r.split(',')[1],\n                            format: format,\n                            saved: false,\n                        });\n                    }\n                };\n                reader.onerror = e => {\n                    reject(e);\n                };\n            }\n        });\n    }\n    async checkPermissions() {\n        if (typeof navigator === 'undefined' || !navigator.permissions) {\n            throw this.unavailable('Permissions API not available in this browser');\n        }\n        try {\n            // https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query\n            // the specific permissions that are supported varies among browsers that implement the\n            // permissions API, so we need a try/catch in case 'camera' is invalid\n            const permission = await window.navigator.permissions.query({\n                name: 'camera',\n            });\n            return {\n                camera: permission.state,\n                photos: 'granted',\n            };\n        }\n        catch (_a) {\n            throw this.unavailable('Camera permissions are not available in this browser');\n        }\n    }\n    async requestPermissions() {\n        throw this.unimplemented('Not implemented on web.');\n    }\n    async pickLimitedLibraryPhotos() {\n        throw this.unavailable('Not implemented on web.');\n    }\n    async getLimitedLibraryPhotos() {\n        throw this.unavailable('Not implemented on web.');\n    }\n}\nconst Camera = new CameraWeb();\n\n//# sourceMappingURL=web.js.map\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/camera/dist/esm/web.js?");

/***/ }),

/***/ "./node_modules/@capacitor/core/dist/index.js":
/*!****************************************************!*\
  !*** ./node_modules/@capacitor/core/dist/index.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Capacitor: () => (/* binding */ Capacitor),\n/* harmony export */   CapacitorCookies: () => (/* binding */ CapacitorCookies),\n/* harmony export */   CapacitorException: () => (/* binding */ CapacitorException),\n/* harmony export */   CapacitorHttp: () => (/* binding */ CapacitorHttp),\n/* harmony export */   ExceptionCode: () => (/* binding */ ExceptionCode),\n/* harmony export */   WebPlugin: () => (/* binding */ WebPlugin),\n/* harmony export */   WebView: () => (/* binding */ WebView),\n/* harmony export */   buildRequestInit: () => (/* binding */ buildRequestInit),\n/* harmony export */   registerPlugin: () => (/* binding */ registerPlugin)\n/* harmony export */ });\n/*! Capacitor: https://capacitorjs.com/ - MIT License */\nvar ExceptionCode;\n(function (ExceptionCode) {\n    /**\n     * API is not implemented.\n     *\n     * This usually means the API can't be used because it is not implemented for\n     * the current platform.\n     */\n    ExceptionCode[\"Unimplemented\"] = \"UNIMPLEMENTED\";\n    /**\n     * API is not available.\n     *\n     * This means the API can't be used right now because:\n     *   - it is currently missing a prerequisite, such as network connectivity\n     *   - it requires a particular platform or browser version\n     */\n    ExceptionCode[\"Unavailable\"] = \"UNAVAILABLE\";\n})(ExceptionCode || (ExceptionCode = {}));\nclass CapacitorException extends Error {\n    constructor(message, code, data) {\n        super(message);\n        this.message = message;\n        this.code = code;\n        this.data = data;\n    }\n}\nconst getPlatformId = (win) => {\n    var _a, _b;\n    if (win === null || win === void 0 ? void 0 : win.androidBridge) {\n        return 'android';\n    }\n    else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {\n        return 'ios';\n    }\n    else {\n        return 'web';\n    }\n};\n\nconst createCapacitor = (win) => {\n    const capCustomPlatform = win.CapacitorCustomPlatform || null;\n    const cap = win.Capacitor || {};\n    const Plugins = (cap.Plugins = cap.Plugins || {});\n    const getPlatform = () => {\n        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);\n    };\n    const isNativePlatform = () => getPlatform() !== 'web';\n    const isPluginAvailable = (pluginName) => {\n        const plugin = registeredPlugins.get(pluginName);\n        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {\n            // JS implementation available for the current platform.\n            return true;\n        }\n        if (getPluginHeader(pluginName)) {\n            // Native implementation available.\n            return true;\n        }\n        return false;\n    };\n    const getPluginHeader = (pluginName) => { var _a; return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName); };\n    const handleError = (err) => win.console.error(err);\n    const registeredPlugins = new Map();\n    const registerPlugin = (pluginName, jsImplementations = {}) => {\n        const registeredPlugin = registeredPlugins.get(pluginName);\n        if (registeredPlugin) {\n            console.warn(`Capacitor plugin \"${pluginName}\" already registered. Cannot register plugins twice.`);\n            return registeredPlugin.proxy;\n        }\n        const platform = getPlatform();\n        const pluginHeader = getPluginHeader(pluginName);\n        let jsImplementation;\n        const loadPluginImplementation = async () => {\n            if (!jsImplementation && platform in jsImplementations) {\n                jsImplementation =\n                    typeof jsImplementations[platform] === 'function'\n                        ? (jsImplementation = await jsImplementations[platform]())\n                        : (jsImplementation = jsImplementations[platform]);\n            }\n            else if (capCustomPlatform !== null && !jsImplementation && 'web' in jsImplementations) {\n                jsImplementation =\n                    typeof jsImplementations['web'] === 'function'\n                        ? (jsImplementation = await jsImplementations['web']())\n                        : (jsImplementation = jsImplementations['web']);\n            }\n            return jsImplementation;\n        };\n        const createPluginMethod = (impl, prop) => {\n            var _a, _b;\n            if (pluginHeader) {\n                const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);\n                if (methodHeader) {\n                    if (methodHeader.rtype === 'promise') {\n                        return (options) => cap.nativePromise(pluginName, prop.toString(), options);\n                    }\n                    else {\n                        return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);\n                    }\n                }\n                else if (impl) {\n                    return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);\n                }\n            }\n            else if (impl) {\n                return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);\n            }\n            else {\n                throw new CapacitorException(`\"${pluginName}\" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);\n            }\n        };\n        const createPluginMethodWrapper = (prop) => {\n            let remove;\n            const wrapper = (...args) => {\n                const p = loadPluginImplementation().then((impl) => {\n                    const fn = createPluginMethod(impl, prop);\n                    if (fn) {\n                        const p = fn(...args);\n                        remove = p === null || p === void 0 ? void 0 : p.remove;\n                        return p;\n                    }\n                    else {\n                        throw new CapacitorException(`\"${pluginName}.${prop}()\" is not implemented on ${platform}`, ExceptionCode.Unimplemented);\n                    }\n                });\n                if (prop === 'addListener') {\n                    p.remove = async () => remove();\n                }\n                return p;\n            };\n            // Some flair ✨\n            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;\n            Object.defineProperty(wrapper, 'name', {\n                value: prop,\n                writable: false,\n                configurable: false,\n            });\n            return wrapper;\n        };\n        const addListener = createPluginMethodWrapper('addListener');\n        const removeListener = createPluginMethodWrapper('removeListener');\n        const addListenerNative = (eventName, callback) => {\n            const call = addListener({ eventName }, callback);\n            const remove = async () => {\n                const callbackId = await call;\n                removeListener({\n                    eventName,\n                    callbackId,\n                }, callback);\n            };\n            const p = new Promise((resolve) => call.then(() => resolve({ remove })));\n            p.remove = async () => {\n                console.warn(`Using addListener() without 'await' is deprecated.`);\n                await remove();\n            };\n            return p;\n        };\n        const proxy = new Proxy({}, {\n            get(_, prop) {\n                switch (prop) {\n                    // https://github.com/facebook/react/issues/20030\n                    case '$$typeof':\n                        return undefined;\n                    case 'toJSON':\n                        return () => ({});\n                    case 'addListener':\n                        return pluginHeader ? addListenerNative : addListener;\n                    case 'removeListener':\n                        return removeListener;\n                    default:\n                        return createPluginMethodWrapper(prop);\n                }\n            },\n        });\n        Plugins[pluginName] = proxy;\n        registeredPlugins.set(pluginName, {\n            name: pluginName,\n            proxy,\n            platforms: new Set([...Object.keys(jsImplementations), ...(pluginHeader ? [platform] : [])]),\n        });\n        return proxy;\n    };\n    // Add in convertFileSrc for web, it will already be available in native context\n    if (!cap.convertFileSrc) {\n        cap.convertFileSrc = (filePath) => filePath;\n    }\n    cap.getPlatform = getPlatform;\n    cap.handleError = handleError;\n    cap.isNativePlatform = isNativePlatform;\n    cap.isPluginAvailable = isPluginAvailable;\n    cap.registerPlugin = registerPlugin;\n    cap.Exception = CapacitorException;\n    cap.DEBUG = !!cap.DEBUG;\n    cap.isLoggingEnabled = !!cap.isLoggingEnabled;\n    return cap;\n};\nconst initCapacitorGlobal = (win) => (win.Capacitor = createCapacitor(win));\n\nconst Capacitor = /*#__PURE__*/ initCapacitorGlobal(typeof globalThis !== 'undefined'\n    ? globalThis\n    : typeof self !== 'undefined'\n        ? self\n        : typeof window !== 'undefined'\n            ? window\n            : typeof __webpack_require__.g !== 'undefined'\n                ? __webpack_require__.g\n                : {});\nconst registerPlugin = Capacitor.registerPlugin;\n\n/**\n * Base class web plugins should extend.\n */\nclass WebPlugin {\n    constructor() {\n        this.listeners = {};\n        this.retainedEventArguments = {};\n        this.windowListeners = {};\n    }\n    addListener(eventName, listenerFunc) {\n        let firstListener = false;\n        const listeners = this.listeners[eventName];\n        if (!listeners) {\n            this.listeners[eventName] = [];\n            firstListener = true;\n        }\n        this.listeners[eventName].push(listenerFunc);\n        // If we haven't added a window listener for this event and it requires one,\n        // go ahead and add it\n        const windowListener = this.windowListeners[eventName];\n        if (windowListener && !windowListener.registered) {\n            this.addWindowListener(windowListener);\n        }\n        if (firstListener) {\n            this.sendRetainedArgumentsForEvent(eventName);\n        }\n        const remove = async () => this.removeListener(eventName, listenerFunc);\n        const p = Promise.resolve({ remove });\n        return p;\n    }\n    async removeAllListeners() {\n        this.listeners = {};\n        for (const listener in this.windowListeners) {\n            this.removeWindowListener(this.windowListeners[listener]);\n        }\n        this.windowListeners = {};\n    }\n    notifyListeners(eventName, data, retainUntilConsumed) {\n        const listeners = this.listeners[eventName];\n        if (!listeners) {\n            if (retainUntilConsumed) {\n                let args = this.retainedEventArguments[eventName];\n                if (!args) {\n                    args = [];\n                }\n                args.push(data);\n                this.retainedEventArguments[eventName] = args;\n            }\n            return;\n        }\n        listeners.forEach((listener) => listener(data));\n    }\n    hasListeners(eventName) {\n        return !!this.listeners[eventName].length;\n    }\n    registerWindowListener(windowEventName, pluginEventName) {\n        this.windowListeners[pluginEventName] = {\n            registered: false,\n            windowEventName,\n            pluginEventName,\n            handler: (event) => {\n                this.notifyListeners(pluginEventName, event);\n            },\n        };\n    }\n    unimplemented(msg = 'not implemented') {\n        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);\n    }\n    unavailable(msg = 'not available') {\n        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);\n    }\n    async removeListener(eventName, listenerFunc) {\n        const listeners = this.listeners[eventName];\n        if (!listeners) {\n            return;\n        }\n        const index = listeners.indexOf(listenerFunc);\n        this.listeners[eventName].splice(index, 1);\n        // If there are no more listeners for this type of event,\n        // remove the window listener\n        if (!this.listeners[eventName].length) {\n            this.removeWindowListener(this.windowListeners[eventName]);\n        }\n    }\n    addWindowListener(handle) {\n        window.addEventListener(handle.windowEventName, handle.handler);\n        handle.registered = true;\n    }\n    removeWindowListener(handle) {\n        if (!handle) {\n            return;\n        }\n        window.removeEventListener(handle.windowEventName, handle.handler);\n        handle.registered = false;\n    }\n    sendRetainedArgumentsForEvent(eventName) {\n        const args = this.retainedEventArguments[eventName];\n        if (!args) {\n            return;\n        }\n        delete this.retainedEventArguments[eventName];\n        args.forEach((arg) => {\n            this.notifyListeners(eventName, arg);\n        });\n    }\n}\n\nconst WebView = /*#__PURE__*/ registerPlugin('WebView');\n/******** END WEB VIEW PLUGIN ********/\n/******** COOKIES PLUGIN ********/\n/**\n * Safely web encode a string value (inspired by js-cookie)\n * @param str The string value to encode\n */\nconst encode = (str) => encodeURIComponent(str)\n    .replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent)\n    .replace(/[()]/g, escape);\n/**\n * Safely web decode a string value (inspired by js-cookie)\n * @param str The string value to decode\n */\nconst decode = (str) => str.replace(/(%[\\dA-F]{2})+/gi, decodeURIComponent);\nclass CapacitorCookiesPluginWeb extends WebPlugin {\n    async getCookies() {\n        const cookies = document.cookie;\n        const cookieMap = {};\n        cookies.split(';').forEach((cookie) => {\n            if (cookie.length <= 0)\n                return;\n            // Replace first \"=\" with CAP_COOKIE to prevent splitting on additional \"=\"\n            let [key, value] = cookie.replace(/=/, 'CAP_COOKIE').split('CAP_COOKIE');\n            key = decode(key).trim();\n            value = decode(value).trim();\n            cookieMap[key] = value;\n        });\n        return cookieMap;\n    }\n    async setCookie(options) {\n        try {\n            // Safely Encoded Key/Value\n            const encodedKey = encode(options.key);\n            const encodedValue = encode(options.value);\n            // Clean & sanitize options\n            const expires = `; expires=${(options.expires || '').replace('expires=', '')}`; // Default is \"; expires=\"\n            const path = (options.path || '/').replace('path=', ''); // Default is \"path=/\"\n            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : '';\n            document.cookie = `${encodedKey}=${encodedValue || ''}${expires}; path=${path}; ${domain};`;\n        }\n        catch (error) {\n            return Promise.reject(error);\n        }\n    }\n    async deleteCookie(options) {\n        try {\n            document.cookie = `${options.key}=; Max-Age=0`;\n        }\n        catch (error) {\n            return Promise.reject(error);\n        }\n    }\n    async clearCookies() {\n        try {\n            const cookies = document.cookie.split(';') || [];\n            for (const cookie of cookies) {\n                document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);\n            }\n        }\n        catch (error) {\n            return Promise.reject(error);\n        }\n    }\n    async clearAllCookies() {\n        try {\n            await this.clearCookies();\n        }\n        catch (error) {\n            return Promise.reject(error);\n        }\n    }\n}\nconst CapacitorCookies = registerPlugin('CapacitorCookies', {\n    web: () => new CapacitorCookiesPluginWeb(),\n});\n// UTILITY FUNCTIONS\n/**\n * Read in a Blob value and return it as a base64 string\n * @param blob The blob value to convert to a base64 string\n */\nconst readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {\n    const reader = new FileReader();\n    reader.onload = () => {\n        const base64String = reader.result;\n        // remove prefix \"data:application/pdf;base64,\"\n        resolve(base64String.indexOf(',') >= 0 ? base64String.split(',')[1] : base64String);\n    };\n    reader.onerror = (error) => reject(error);\n    reader.readAsDataURL(blob);\n});\n/**\n * Normalize an HttpHeaders map by lowercasing all of the values\n * @param headers The HttpHeaders object to normalize\n */\nconst normalizeHttpHeaders = (headers = {}) => {\n    const originalKeys = Object.keys(headers);\n    const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());\n    const normalized = loweredKeys.reduce((acc, key, index) => {\n        acc[key] = headers[originalKeys[index]];\n        return acc;\n    }, {});\n    return normalized;\n};\n/**\n * Builds a string of url parameters that\n * @param params A map of url parameters\n * @param shouldEncode true if you should encodeURIComponent() the values (true by default)\n */\nconst buildUrlParams = (params, shouldEncode = true) => {\n    if (!params)\n        return null;\n    const output = Object.entries(params).reduce((accumulator, entry) => {\n        const [key, value] = entry;\n        let encodedValue;\n        let item;\n        if (Array.isArray(value)) {\n            item = '';\n            value.forEach((str) => {\n                encodedValue = shouldEncode ? encodeURIComponent(str) : str;\n                item += `${key}=${encodedValue}&`;\n            });\n            // last character will always be \"&\" so slice it off\n            item.slice(0, -1);\n        }\n        else {\n            encodedValue = shouldEncode ? encodeURIComponent(value) : value;\n            item = `${key}=${encodedValue}`;\n        }\n        return `${accumulator}&${item}`;\n    }, '');\n    // Remove initial \"&\" from the reduce\n    return output.substr(1);\n};\n/**\n * Build the RequestInit object based on the options passed into the initial request\n * @param options The Http plugin options\n * @param extra Any extra RequestInit values\n */\nconst buildRequestInit = (options, extra = {}) => {\n    const output = Object.assign({ method: options.method || 'GET', headers: options.headers }, extra);\n    // Get the content-type\n    const headers = normalizeHttpHeaders(options.headers);\n    const type = headers['content-type'] || '';\n    // If body is already a string, then pass it through as-is.\n    if (typeof options.data === 'string') {\n        output.body = options.data;\n    }\n    // Build request initializers based off of content-type\n    else if (type.includes('application/x-www-form-urlencoded')) {\n        const params = new URLSearchParams();\n        for (const [key, value] of Object.entries(options.data || {})) {\n            params.set(key, value);\n        }\n        output.body = params.toString();\n    }\n    else if (type.includes('multipart/form-data') || options.data instanceof FormData) {\n        const form = new FormData();\n        if (options.data instanceof FormData) {\n            options.data.forEach((value, key) => {\n                form.append(key, value);\n            });\n        }\n        else {\n            for (const key of Object.keys(options.data)) {\n                form.append(key, options.data[key]);\n            }\n        }\n        output.body = form;\n        const headers = new Headers(output.headers);\n        headers.delete('content-type'); // content-type will be set by `window.fetch` to includy boundary\n        output.headers = headers;\n    }\n    else if (type.includes('application/json') || typeof options.data === 'object') {\n        output.body = JSON.stringify(options.data);\n    }\n    return output;\n};\n// WEB IMPLEMENTATION\nclass CapacitorHttpPluginWeb extends WebPlugin {\n    /**\n     * Perform an Http request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async request(options) {\n        const requestInit = buildRequestInit(options, options.webFetchExtra);\n        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);\n        const url = urlParams ? `${options.url}?${urlParams}` : options.url;\n        const response = await fetch(url, requestInit);\n        const contentType = response.headers.get('content-type') || '';\n        // Default to 'text' responseType so no parsing happens\n        let { responseType = 'text' } = response.ok ? options : {};\n        // If the response content-type is json, force the response to be json\n        if (contentType.includes('application/json')) {\n            responseType = 'json';\n        }\n        let data;\n        let blob;\n        switch (responseType) {\n            case 'arraybuffer':\n            case 'blob':\n                blob = await response.blob();\n                data = await readBlobAsBase64(blob);\n                break;\n            case 'json':\n                data = await response.json();\n                break;\n            case 'document':\n            case 'text':\n            default:\n                data = await response.text();\n        }\n        // Convert fetch headers to Capacitor HttpHeaders\n        const headers = {};\n        response.headers.forEach((value, key) => {\n            headers[key] = value;\n        });\n        return {\n            data,\n            headers,\n            status: response.status,\n            url: response.url,\n        };\n    }\n    /**\n     * Perform an Http GET request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async get(options) {\n        return this.request(Object.assign(Object.assign({}, options), { method: 'GET' }));\n    }\n    /**\n     * Perform an Http POST request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async post(options) {\n        return this.request(Object.assign(Object.assign({}, options), { method: 'POST' }));\n    }\n    /**\n     * Perform an Http PUT request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async put(options) {\n        return this.request(Object.assign(Object.assign({}, options), { method: 'PUT' }));\n    }\n    /**\n     * Perform an Http PATCH request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async patch(options) {\n        return this.request(Object.assign(Object.assign({}, options), { method: 'PATCH' }));\n    }\n    /**\n     * Perform an Http DELETE request given a set of options\n     * @param options Options to build the HTTP request\n     */\n    async delete(options) {\n        return this.request(Object.assign(Object.assign({}, options), { method: 'DELETE' }));\n    }\n}\nconst CapacitorHttp = registerPlugin('CapacitorHttp', {\n    web: () => new CapacitorHttpPluginWeb(),\n});\n/******** END HTTP PLUGIN ********/\n\n\n//# sourceMappingURL=index.js.map\n\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/core/dist/index.js?");

/***/ }),

/***/ "./node_modules/@capacitor/splash-screen/dist/esm/definitions.js":
/*!***********************************************************************!*\
  !*** ./node_modules/@capacitor/splash-screen/dist/esm/definitions.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/// <reference types=\"@capacitor/cli\" />\n\n//# sourceMappingURL=definitions.js.map\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/splash-screen/dist/esm/definitions.js?");

/***/ }),

/***/ "./node_modules/@capacitor/splash-screen/dist/esm/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@capacitor/splash-screen/dist/esm/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   SplashScreen: () => (/* binding */ SplashScreen)\n/* harmony export */ });\n/* harmony import */ var _capacitor_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @capacitor/core */ \"./node_modules/@capacitor/core/dist/index.js\");\n/* harmony import */ var _definitions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./definitions */ \"./node_modules/@capacitor/splash-screen/dist/esm/definitions.js\");\n\nconst SplashScreen = (0,_capacitor_core__WEBPACK_IMPORTED_MODULE_0__.registerPlugin)('SplashScreen', {\n    web: () => __webpack_require__.e(/*! import() */ \"node_modules_capacitor_splash-screen_dist_esm_web_js\").then(__webpack_require__.bind(__webpack_require__, /*! ./web */ \"./node_modules/@capacitor/splash-screen/dist/esm/web.js\")).then(m => new m.SplashScreenWeb()),\n});\n\n\n//# sourceMappingURL=index.js.map\n\n//# sourceURL=webpack://capacitor-app/./node_modules/@capacitor/splash-screen/dist/esm/index.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _capacitor_splash_screen__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @capacitor/splash-screen */ \"./node_modules/@capacitor/splash-screen/dist/esm/index.js\");\n/* harmony import */ var _capacitor_camera__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @capacitor/camera */ \"./node_modules/@capacitor/camera/dist/esm/index.js\");\n\n\nwindow.customElements.define('capacitor-welcome', class extends HTMLElement {\n  constructor() {\n    super();\n    _capacitor_splash_screen__WEBPACK_IMPORTED_MODULE_0__.SplashScreen.hide();\n    const root = this.attachShadow({\n      mode: 'open'\n    });\n    root.innerHTML = `\n    <style>\n      :host {\n        font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n        display: block;\n        width: 100%;\n        height: 100%;\n      }\n      h1, h2, h3, h4, h5 {\n        text-transform: uppercase;\n      }\n      .button {\n        display: inline-block;\n        padding: 10px;\n        background-color: #73B5F6;\n        color: #fff;\n        font-size: 0.9em;\n        border: 0;\n        border-radius: 3px;\n        text-decoration: none;\n        cursor: pointer;\n      }\n      main {\n        padding: 15px;\n      }\n      main hr { height: 1px; background-color: #eee; border: 0; }\n      main h1 {\n        font-size: 1.4em;\n        text-transform: uppercase;\n        letter-spacing: 1px;\n      }\n      main h2 {\n        font-size: 1.1em;\n      }\n      main h3 {\n        font-size: 0.9em;\n      }\n      main p {\n        color: #333;\n      }\n      main pre {\n        white-space: pre-line;\n      }\n    </style>\n    <div>\n      <capacitor-welcome-titlebar>\n        <h1>Capacitor</h1>\n      </capacitor-welcome-titlebar>\n      <main>\n        <p>\n          Capacitor makes it easy to build powerful apps for the app stores, mobile web (Progressive Web Apps), and desktop, all\n          with a single code base.\n        </p>\n        <h2>Getting Started</h2>\n        <p>\n          You'll probably need a UI framework to build a full-featured app. Might we recommend\n          <a target=\"_blank\" href=\"http://ionicframework.com/\">Ionic</a>?\n        </p>\n        <p>\n          Visit <a href=\"https://capacitorjs.com\">capacitorjs.com</a> for information\n          on using native features, building plugins, and more.\n        </p>\n        <a href=\"https://capacitorjs.com\" target=\"_blank\" class=\"button\">Read more</a>\n        <h2>Tiny Demo</h2>\n        <p>\n          This demo shows how to call Capacitor plugins. Say cheese!\n        </p>\n        <p>\n          <button class=\"button\" id=\"take-photo\">Take Photo</button>\n        </p>\n        <p>\n          <img id=\"image\" style=\"max-width: 100%\">\n        </p>\n      </main>\n    </div>\n    `;\n  }\n  connectedCallback() {\n    const self = this;\n    self.shadowRoot.querySelector('#take-photo').addEventListener('click', async function (e) {\n      try {\n        const photo = await _capacitor_camera__WEBPACK_IMPORTED_MODULE_1__.Camera.getPhoto({\n          resultType: 'uri'\n        });\n        const image = self.shadowRoot.querySelector('#image');\n        if (!image) {\n          return;\n        }\n        image.src = photo.webPath;\n      } catch (e) {\n        console.warn('User cancelled', e);\n      }\n    });\n  }\n});\nwindow.customElements.define('capacitor-welcome-titlebar', class extends HTMLElement {\n  constructor() {\n    super();\n    const root = this.attachShadow({\n      mode: 'open'\n    });\n    root.innerHTML = `\n    <style>\n      :host {\n        position: relative;\n        display: block;\n        padding: 15px 15px 15px 15px;\n        text-align: center;\n        background-color: #73B5F6;\n      }\n      ::slotted(h1) {\n        margin: 0;\n        font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n        font-size: 0.9em;\n        font-weight: 600;\n        color: #fff;\n      }\n    </style>\n    <slot></slot>\n    `;\n  }\n});\n\n//# sourceURL=webpack://capacitor-app/./src/index.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".app.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "capacitor-app:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				script.timeout = 120;
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript && document.currentScript.tagName.toUpperCase() === 'SCRIPT')
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) {
/******/ 					var i = scripts.length - 1;
/******/ 					while (i > -1 && (!scriptUrl || !/^http(s?):/.test(scriptUrl))) scriptUrl = scripts[i--].src;
/******/ 				}
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/^blob:/, "").replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"main": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkcapacitor_app"] = self["webpackChunkcapacitor_app"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;