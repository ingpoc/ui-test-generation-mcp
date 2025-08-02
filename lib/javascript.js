/**
 * Utility functions for JavaScript code generation and manipulation
 */

/**
 * Properly quotes a JavaScript function or expression for safe evaluation
 * @param {string} code - The JavaScript code to quote
 * @returns {string} - The properly quoted code
 */
export function quote(code) {
    if (typeof code !== 'string') {
        throw new Error('Code must be a string');
    }
    
    // If the code is already a function expression, return as-is
    if (code.trim().startsWith('(') && code.trim().endsWith(')')) {
        return code;
    }
    
    // If it looks like a function declaration, wrap it in parentheses
    if (code.trim().startsWith('function') || code.trim().includes('=>')) {
        return `(${code})`;
    }
    
    // For other expressions, wrap in an arrow function
    return `(() => { ${code} })`;
}