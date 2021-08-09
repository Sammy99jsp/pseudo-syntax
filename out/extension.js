"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const tokenTypes = new Map();
const tokenModifiers = new Map();
const legend = (function () {
    const tokenTypesLegend = [
        'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
        'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
        'method', 'macro', 'variable', 'parameter', 'property', 'label'
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
    const tokenModifiersLegend = [
        'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
        'modification', 'async'
    ];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));
    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'edexcel.pseudo' }, new DocumentSemanticTokensProvider(), legend));
}
exports.activate = activate;
const variables = [];
const subprograms = [
    "SEND",
    "RECEIVE",
    "READ",
    "WRITE",
    "LENGTH",
    "PRINT",
    "subString",
    "upper"
];
const devices = [
    "DISPLAY",
    "KEYBOARD",
    "CARD_READER",
    "LIGHTS"
];
const types = [
    "INTEGER",
    "INT",
    "FLOAT",
    "REAL",
    "STRING",
    "ARRAY"
];
class DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document, token) {
        const allTokens = this._parseText(document.getText());
        const builder = new vscode.SemanticTokensBuilder();
        allTokens.forEach((token) => {
            builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
        });
        return builder.build();
    }
    _encodeTokenType(tokenType) {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType);
        }
        else if (tokenType === 'notInLegend') {
            return tokenTypes.size + 2;
        }
        return 0;
    }
    _encodeTokenModifiers(strTokenModifiers) {
        let result = 0;
        for (let i = 0; i < strTokenModifiers.length; i++) {
            const tokenModifier = strTokenModifiers[i];
            if (tokenModifiers.has(tokenModifier)) {
                result = result | (1 << tokenModifiers.get(tokenModifier));
            }
            else if (tokenModifier === 'notInLegend') {
                result = result | (1 << tokenModifiers.size + 2);
            }
        }
        return result;
    }
    static speechMarksFromPos(line, index) {
        if (line.replace(/\s/gi, "")[0] === "#") {
            return [0];
        }
        const occurences = [];
        for (let i = index; i > -1; i--) {
            if (line[i] == `"`) {
                if (line[i - 1] != `\\`) {
                    occurences.push(i);
                }
            }
        }
        return occurences;
    }
    static findPropertyGenerator([properties, regTemplate, propertyType]) {
        return function (line, lineNumber) {
            const _propertiesFoundInLine = properties.map(property => line.matchAll(new RegExp(regTemplate.replace("$", property), propertyType === "variable" ? "g" : "gi"))).filter(e => e != null);
            const propertiesFoundInLine = _propertiesFoundInLine.map(v => { return [...v]; }).flat();
            if (propertiesFoundInLine.length > 0) {
                const propertyTokens = propertiesFoundInLine.map(found => {
                    if ([found.index, found[0]].some(f => f == undefined)) {
                        return null;
                    }
                    if (DocumentSemanticTokensProvider.speechMarksFromPos(line, found.index).length % 2 == 1) {
                        return null;
                    }
                    return {
                        line: lineNumber,
                        startCharacter: found.index,
                        length: found[0].length,
                        tokenType: propertyType,
                        tokenModifiers: []
                    };
                }).filter(e => e != undefined);
                return propertyTokens;
            }
            return [];
        };
    }
    _parseText(text) {
        let r = [];
        const lines = text.split(/\r\n|\r|\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            do {
                const declarationREx = [
                    [/SET\s+(\w+)\s+TO/, "variable"],
                    [/RECEIVE\s+(\w+)\s+FROM/, "variable"],
                    [/FOR\s+(\w+)\sFROM/, "variable"],
                    [/FUNCTION\s+(\w+)\s*\(.*\)/, "function"]
                ];
                const variableREx = /^([A-Za-z]+[A-Za-z0-9]*)/;
                const checks = [
                    [variables, "\\b($)\\b", "variable"],
                    [subprograms, "($)", "function"],
                    [devices, "\\b($)\\b", "interface"],
                    [types, "(?<=(\\(|\\b))($)(?=(\\)|\\b))", "enum"],
                    [subprograms, "(($)(?=(\\(.*\\))))", "function"]
                ];
                // Looks for property tokens (variables, subprograms, devices)
                const tokenCheckers = checks.map(DocumentSemanticTokensProvider.findPropertyGenerator);
                r = [...r, ...tokenCheckers.map(f => f(line, i)).reduce((a, b) => [...a, ...b], [])];
                // // Look for subprograms
                // const subprogramsFoundInLine = subprograms.map(subprogram => line.match(new RegExp(`(${subprogram})`))).filter(e => e != null) as RegExpMatchArray[];
                // if(subprogramsFoundInLine.length > 0) {
                //     const subprogramTokens = subprogramsFoundInLine.map(found => {
                //         if([found.index, found[0]].some(f => f == undefined)) {
                //             return null;
                //         }
                //         return {
                //             line: i,
                //             startCharacter: found.index,
                //             length: found[0].length,
                //             tokenType: "function",
                //             tokenModifiers: []
                //         };
                //     }).filter(e => e != undefined) as unknown as IParsedToken[];
                //     r = [...r, ...subprogramTokens];
                // }
                // // Look for variables
                // const variablesFoundInLine = variables.map(variable => line.match(new RegExp(`\\b(${variable})\\b`))).filter(e => e != null) as RegExpMatchArray[];
                // if(variablesFoundInLine.length > 0) {
                //     const varTokens = variablesFoundInLine.map(found => {
                //         if([found.index, found[0]].some(f => f == undefined)) {
                //             return null;
                //         }
                //         return {
                //             line: i,
                //             startCharacter: found.index,
                //             length: found[0].length,
                //             tokenType: "variable",
                //             tokenModifiers: []
                //         };
                //     }).filter(e => e != undefined) as unknown as IParsedToken[];
                //     console.log("Found", varTokens.length, "variables in line", i);
                //     r = [...r, ...varTokens];
                // }
                if (declarationREx.some(e => e[0].test(line))) {
                    declarationREx.forEach(e => {
                        const potentialVar = e[0].exec(line);
                        if (potentialVar) {
                            if (variableREx.test(potentialVar[1])) {
                                const validVar = potentialVar[1];
                                // Valid variable
                                // eslint-disable-next-line no-unused-labels
                                const toChange = { variable: variables, function: subprograms };
                                toChange[e[1]].push(validVar);
                                // Make variable token
                                r.push({
                                    line: i,
                                    startCharacter: line.search(validVar),
                                    length: validVar.length,
                                    tokenType: e[1],
                                    tokenModifiers: ["declaration"]
                                });
                            }
                        }
                    });
                }
                break;
                // r.push({
                // 	line: i,
                // 	startCharacter: openOffset + 1,
                // 	length: closeOffset - openOffset - 1,
                // 	tokenType: tokenData.tokenType,
                // 	tokenModifiers: tokenData.tokenModifiers
                // });
            } while (true);
        }
        return r;
    }
    _parseTextToken(text) {
        const parts = text.split('.');
        return {
            tokenType: parts[0],
            tokenModifiers: parts.slice(1)
        };
    }
}
//# sourceMappingURL=extension.js.map