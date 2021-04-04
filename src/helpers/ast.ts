import {
    factory,
    createPrinter,
    createSourceFile,
    SyntaxKind,
    ScriptKind,
    ScriptTarget,
    ListFormat,
    NewLineKind,
    Expression,
    ObjectLiteralExpression,
    ArrayLiteralExpression,
    PropertyAssignment,
    NewExpression,
    Identifier,
    StringLiteral,
    NumericLiteral,
    BooleanLiteral,
    Modifier,
    VariableStatement,
    NodeFlags,
    TypeReferenceNode,
    TypeNode,
    KeywordTypeNode,
    ArrayTypeNode
} from "typescript";
import fs from "fs";

export const EXPORT_MODIFIER = factory.createModifier(SyntaxKind.ExportKeyword);

export function makeValueLiteral(value: any): Expression {
    if (Array.isArray(value)) {
        return arrayToArrayLiteral(value);
    }
    switch (typeof(value)) {
        case "string":
            return makeStringLiteral(value);
        case "number":
            return makeNumericLiteral(value);
        case "boolean":
            return makeBooleanLiteral(value);
        case "object":
            return objectToObjectLiteral(value);
        case "undefined":
            return makeIdentifier("undefined");    
        default:
            throw new Error(`Unrecognized type: ${typeof(value)}`);
    }
}

export function objectToObjectLiteral(object: any): ObjectLiteralExpression {
    const properties = [];
    for (const prop of Object.keys(object)) {
        properties.push(makePropertyAssignment(prop, makeValueLiteral(object[prop])));
    }
    return makeObjectLiteral(properties);
}

export function arrayToArrayLiteral(array: any[]): ArrayLiteralExpression {
    const values = array.map((v) => makeValueLiteral(v));
    return makeArrayLiteral(values);
}

export function makeObjectLiteral(properties): ObjectLiteralExpression {
    return factory.createObjectLiteralExpression(properties, true);
}

export function makeArrayLiteral(values: Expression[]): ArrayLiteralExpression {
    return factory.createArrayLiteralExpression(values, true);
}

export function makePropertyAssignment(propName: string, initializer): PropertyAssignment{
    return factory.createPropertyAssignment(
        makeIdentifier(propName),
        initializer
    );
}

export function makeIdentifier(text: string): Identifier {
    return factory.createIdentifier(text);
}

export function makeStringLiteral(text: string): StringLiteral {
    return factory.createStringLiteral(text);
}

export function makeNumericLiteral(number: number): NumericLiteral {
    return factory.createNumericLiteral(String(number));
}

export function makeBooleanLiteral(bool: boolean): BooleanLiteral {
    return bool ? factory.createTrue() : factory.createFalse();
}

export function makeTypeReferenceNode(typeName: string, args: TypeNode[]): TypeReferenceNode {
    return factory.createTypeReferenceNode(
        makeIdentifier(typeName),
        args
    );
}

export function makeStringKeywordTypeNode(): KeywordTypeNode<SyntaxKind.StringKeyword> {
    return factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
}

export function makeUnknownKeywordTypeNode(): KeywordTypeNode<SyntaxKind.UnknownKeyword> {
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

export function makeArrayTypeNode(node: KeywordTypeNode | ArrayTypeNode): ArrayTypeNode {
    return factory.createArrayTypeNode(node);
}

export function makeVariableStatement(
        modifiers: Modifier[],
        variableName: string,
        variableInitializer: Expression,
        flag = NodeFlags.Const
    ): VariableStatement {
    return factory.createVariableStatement(
        modifiers,
        factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(
                makeIdentifier(variableName),
                undefined,
                undefined,
                variableInitializer
            )], flag
        )
    );
}

export function makeCallExpression(functionName: string, args: Expression[]) {
    return factory.createCallExpression(
        makeIdentifier(functionName),
        undefined,
        args
    );
}

export function makeExpressionStatement(expr: Expression) {
    return factory.createExpressionStatement(expr);
}

export function makeEqualsBinaryExpression(leftExpr: Expression, rightExpr: Expression) {
    return factory.createBinaryExpression(
        leftExpr,
        factory.createToken(SyntaxKind.EqualsToken),
        rightExpr
    );
}

export function makePropertyAccess(expr: Expression, propName: string) {
    return factory.createPropertyAccessExpression(expr, makeIdentifier(propName));
}

export function makeEnum(modifiers: Modifier[], enumName: string, values: string[]) {
    return factory.createEnumDeclaration(
        undefined,
        modifiers,
        makeIdentifier(enumName),
        values.map((v) => factory.createEnumMember(makeIdentifier(v), undefined))
    );
}

export function makeNew(expression: Expression, args: Expression[]): NewExpression {
    return factory.createNewExpression(
        expression,
        undefined,
        args
    );
}

export function writeJavascript(statements, output) {
    const tsPrinter = createPrinter({
        newLine: NewLineKind.LineFeed
    });
    const sourceFile = createSourceFile(
        output,
        "",
        ScriptTarget.ES2015,
        false,
        ScriptKind.JS
    );
    const tsSource = tsPrinter.printList(
        ListFormat.MultiLine,
        factory.createNodeArray(statements),
        sourceFile
    );

    fs.writeFileSync(output, tsSource, "utf-8");
}