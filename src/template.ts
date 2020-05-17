
export async function template(literals, ...expressions) {
    const resolvedExpr = await Promise.all(expressions);
    let string = "";
    for (const [i, val] of resolvedExpr.entries()) {
        if (Array.isArray(val)) {
            const resolvedValues = await Promise.all(val);
            string += `${literals[i]}${resolvedValues.filter(v => v !== null && v !== undefined).join("")}`;
        } else {
            string += `${literals[i]}${(val === null || val === undefined) ? "" : val}`;
        }
    }
    string += literals[literals.length - 1];
    return string;
}
