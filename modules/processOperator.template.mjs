// Import necessary dependencies
import { of } from "rxjs";
import { z } from "zod";

// Export key, version, and description
export const key = "yourOperatorKey";
export const version = "0.0.1";
export const description = `Your operator description.`;

// Define the input schema
export function input(operable) {
    const schema = z
        .object({
            // Define your input schema here
        })
        .description("Your input schema description.");

    return of(schema);
}

// Define the config schema
export function config(operable) {
    const schema = z
        .object({
            // Define your config schema here
        })
        .required(["Your required fields"]);

    return of(schema);
}

// Define the output schema (optional)
export function output(operable) {
    const schema = z
        .object({
            // Define your output schema here
        })
        .description("Your output schema description.");

    return of(schema);
}

// Define the keys schema (optional)
export function keys(operable) {
    const schema = z
        .object({
            // Define your keys schema here
        })
        .description("Your keys schema description.");

    return of(schema);
}

// Define the actual process operator
export default function yourOperator(operable) {
    // Your operator logic here
}
