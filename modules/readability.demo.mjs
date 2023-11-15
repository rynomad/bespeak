import { of, Subject } from "rxjs";
import readabilityOperator from "./readability.mjs";

// Sample HTML content
const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Article</title>
</head>
<body>
  <h1>Test Article</h1>
  <p>This is a test article for the Readability.js parsing operation.</p>
</body>
</html>
`;

// Sample configuration
const config = {
    basic: {
        stripUnlikelyCandidates: true,
        cleanConditionally: true,
        weightClasses: true,
    },
    advanced: {
        charThreshold: 500,
        classesToPreserve: [],
        debug: false,
    },
};

// Payload
const payload = {
    url: "https://www.npmjs.com/package/openai",
};

// Status observable
const status$ = new Subject();

// Subscribe to the status observable to log status messages
status$.subscribe((status) => console.log("Status:", status));

// Use the readability operator to parse the HTML content
of(payload)
    .pipe(readabilityOperator(config, null, status$))
    .subscribe(
        (result) => console.log("Result:", result),
        (error) => console.error("Error:", error)
    );
