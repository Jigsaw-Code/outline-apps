"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePackageData = void 0;
const semver = require("semver");
const hosted_git_info_1 = require("hosted-git-info");
const url = require("url");
function normalizePackageData(data) {
    for (const it of check) {
        it(data);
    }
}
exports.normalizePackageData = normalizePackageData;
const depTypes = ["dependencies", "devDependencies", "optionalDependencies"];
const check = [
    function (data) {
        if (data.repositories) {
            data.repository = data.repositories[0];
        }
        if (typeof data.repository === "string") {
            data.repository = {
                type: "git",
                url: data.repository,
            };
        }
        if (data.repository != null && data.repository.url) {
            const hosted = hosted_git_info_1.fromUrl(data.repository.url);
            if (hosted) {
                data.repository.url = hosted.getDefaultRepresentation() == "shortcut" ? hosted.https() : hosted.toString();
            }
        }
    },
    function (data) {
        const files = data.files;
        if (files && !Array.isArray(files)) {
            delete data.files;
        }
        else if (data.files) {
            data.files = data.files.filter(function (file) {
                return !(!file || typeof file !== "string");
            });
        }
    },
    function (data) {
        if (!data.bin) {
            return;
        }
        if (typeof data.bin === "string") {
            const b = {};
            const match = data.name.match(/^@[^/]+[/](.*)$/);
            if (match) {
                b[match[1]] = data.bin;
            }
            else {
                b[data.name] = data.bin;
            }
            data.bin = b;
        }
    },
    function (data) {
        if (data.description && typeof data.description !== "string") {
            delete data.description;
        }
        if (data.description === undefined) {
            delete data.description;
        }
    },
    fixBundleDependenciesField,
    function fixDependencies(data) {
        objectifyDeps(data);
        fixBundleDependenciesField(data);
        for (const deps of ["dependencies", "devDependencies", "optionalDependencies"]) {
            if (!(deps in data)) {
                continue;
            }
            if (!data[deps] || typeof data[deps] !== "object") {
                delete data[deps];
                continue;
            }
            Object.keys(data[deps]).forEach(function (d) {
                const r = data[deps][d];
                if (typeof r !== "string") {
                    delete data[deps][d];
                }
                const hosted = hosted_git_info_1.fromUrl(data[deps][d]);
                if (hosted) {
                    data[deps][d] = hosted.toString();
                }
            });
        }
    },
    function fixBugsField(data) {
        if (!data.bugs && data.repository && data.repository.url) {
            const hosted = hosted_git_info_1.fromUrl(data.repository.url);
            if (hosted && hosted.bugs()) {
                data.bugs = { url: hosted.bugs() };
            }
        }
        else if (data.bugs) {
            const emailRe = /^.+@.*\..+$/;
            if (typeof data.bugs == "string") {
                if (emailRe.test(data.bugs)) {
                    data.bugs = { email: data.bugs };
                }
                else if (url.parse(data.bugs).protocol) {
                    data.bugs = { url: data.bugs };
                }
            }
            else {
                bugsTypos(data.bugs);
                const oldBugs = data.bugs;
                data.bugs = {};
                if (oldBugs.url) {
                    if (typeof oldBugs.url == "string" && url.parse(oldBugs.url).protocol) {
                        data.bugs.url = oldBugs.url;
                    }
                }
                if (oldBugs.email) {
                    if (typeof oldBugs.email == "string" && emailRe.test(oldBugs.email)) {
                        data.bugs.email = oldBugs.email;
                    }
                }
            }
            if (!data.bugs.email && !data.bugs.url) {
                delete data.bugs;
            }
        }
    },
    function fixModulesField(data) {
        if (data.modules) {
            delete data.modules;
        }
    },
    function fixKeywordsField(data) {
        if (typeof data.keywords === "string") {
            data.keywords = data.keywords.split(/,\s+/);
        }
        if (data.keywords && !Array.isArray(data.keywords)) {
            delete data.keywords;
        }
        else if (data.keywords) {
            data.keywords = data.keywords.filter(function (kw) {
                return !(typeof kw !== "string" || !kw);
            });
        }
    },
    function fixVersionField(data) {
        const loose = true;
        if (!data.version) {
            data.version = "";
            return true;
        }
        if (!semver.valid(data.version, loose)) {
            throw new Error(`Invalid version: "${data.version}"`);
        }
        data.version = semver.clean(data.version, loose);
        return true;
    },
    function fixPeople(data) {
        modifyPeople(data, unParsePerson);
        modifyPeople(data, parsePerson);
    },
    function fixNameField(data) {
        if (!data.name) {
            data.name = "";
            return;
        }
        if (typeof data.name !== "string") {
            throw new Error("name field must be a string.");
        }
        data.name = data.name.trim();
        ensureValidName(data.name);
    },
    function fixHomepageField(data) {
        if (!data.homepage && data.repository && data.repository.url) {
            const hosted = hosted_git_info_1.fromUrl(data.repository.url);
            if (hosted && hosted.docs()) {
                data.homepage = hosted.docs();
            }
        }
        if (!data.homepage) {
            return;
        }
        if (typeof data.homepage !== "string") {
            delete data.homepage;
        }
        if (!url.parse(data.homepage).protocol) {
            data.homepage = `https://${data.homepage}`;
        }
        return;
    },
];
function fixBundleDependenciesField(data) {
    const bdd = "bundledDependencies";
    const bd = "bundleDependencies";
    if (data[bdd] && !data[bd]) {
        data[bd] = data[bdd];
        delete data[bdd];
    }
    if (data[bd] && !Array.isArray(data[bd])) {
        delete data[bd];
    }
    else if (data[bd]) {
        data[bd] = data[bd].filter(function (bd) {
            if (!bd || typeof bd !== "string") {
                return false;
            }
            else {
                if (!data.dependencies) {
                    data.dependencies = {};
                }
                if (!("bd" in data.dependencies)) {
                    data.dependencies[bd] = "*";
                }
                return true;
            }
        });
    }
}
function isValidScopedPackageName(spec) {
    if (spec.charAt(0) !== "@") {
        return false;
    }
    const rest = spec.slice(1).split("/");
    if (rest.length !== 2) {
        return false;
    }
    return rest[0] !== "" && rest[1] !== "" && rest[0] != null && rest[1] != null && rest[0] === encodeURIComponent(rest[0]) && rest[1] === encodeURIComponent(rest[1]);
}
function isCorrectlyEncodedName(spec) {
    return !/[/@\s+%:]/.test(spec) && spec === encodeURIComponent(spec);
}
function ensureValidName(name) {
    if (name.charAt(0) === "." ||
        !(isValidScopedPackageName(name) || isCorrectlyEncodedName(name)) ||
        name.toLowerCase() === "node_modules" ||
        name.toLowerCase() === "favicon.ico") {
        throw new Error("Invalid name: " + JSON.stringify(name));
    }
}
function modifyPeople(data, fn) {
    if (data.author) {
        data.author = fn(data.author);
    }
    for (const set of ["maintainers", "contributors"]) {
        if (!Array.isArray(data[set])) {
            continue;
        }
        data[set] = data[set].map(fn);
    }
    return data;
}
function unParsePerson(person) {
    if (typeof person === "string") {
        return person;
    }
    const name = person.name || "";
    const u = person.url || person.web;
    const url = u ? ` (${u})` : "";
    const e = person.email || person.mail;
    const email = e ? ` <${e}>` : "";
    return `${name}${email}${url}`;
}
function parsePerson(person) {
    if (typeof person !== "string") {
        return person;
    }
    const name = /^([^(<]+)/.exec(person);
    const url = /\(([^)]+)\)/.exec(person);
    const email = /<([^>]+)>/.exec(person);
    const obj = {};
    if (name && name[0].trim()) {
        obj.name = name[0].trim();
    }
    if (email) {
        obj.email = email[1];
    }
    if (url) {
        obj.url = url[1];
    }
    return obj;
}
function depObjectify(deps) {
    if (!deps) {
        return {};
    }
    if (typeof deps === "string") {
        deps = deps.trim().split(/[\n\r\s\t ,]+/);
    }
    if (!Array.isArray(deps)) {
        return deps;
    }
    const o = {};
    deps
        .filter(function (d) {
        return typeof d === "string";
    })
        .forEach(function (d) {
        d = d.trim().split(/(:?[@\s><=])/);
        const dn = d.shift();
        let dv = d.join("");
        dv = dv.trim();
        dv = dv.replace(/^@/, "");
        o[dn] = dv;
    });
    return o;
}
function objectifyDeps(data) {
    depTypes.forEach(function (type) {
        if (!data[type]) {
            return;
        }
        data[type] = depObjectify(data[type]);
    });
}
const typoBugs = { web: "url", name: "url" };
function bugsTypos(bugs) {
    if (!bugs) {
        return;
    }
    Object.keys(bugs).forEach(function (k) {
        if (typoBugs[k]) {
            bugs[typoBugs[k]] = bugs[k];
            delete bugs[k];
        }
    });
}
//# sourceMappingURL=normalizePackageData.js.map