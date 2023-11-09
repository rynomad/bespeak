export default {
  "id": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
  "name": "Adapter Generator",
  "nodes": [
    {
      "id": "16901044b9e4c982",
      "key": "flow-input",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 369.0001875,
      "y": 98.5
    },
    {
      "id": "5ea9c8fcc15f3fce",
      "key": "flow-output",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 337.5161875,
      "y": 600.477
    },
    {
      "id": "7bd97edf7e27c2d2",
      "key": "chat-gpt",
      "version": 17,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "role": "user",
        "placement": "prepend",
        "joinStrategy": "none",
        "n": 1,
        "temperature": 0.3,
        "model": "gpt-4",
        "history": 0,
        "call": true,
        "context": "none",
        "prompt": "I will provide you with an input schema and an output schema, I need you to write me a javascript module that will have a default export of a function that will transform an input value matching the input schema and return a value matching the output schema.\n\nIt is imperative that you respond with functional code. Do not provide scaffold or example code, but a true implementation.\n\nYour target environment is a web browser, using es6 module syntax.\nImport any necessary dependencies from https://esm.sh\n\nDo not use node.js libraries, only browser code."
      },
      "x": 443.5311875,
      "y": 318.03218749999996
    },
    {
      "id": "9a0b53fac1248b15",
      "key": "code-parser",
      "version": 5,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "language": "javascript"
      },
      "x": 224.7741875,
      "y": 462.258
    }
  ],
  "connections": [
    {
      "id": "61ee3935e6132353",
      "source": "16901044b9e4c982",
      "sourceOutput": "output",
      "target": "7bd97edf7e27c2d2",
      "targetInput": "input"
    },
    {
      "id": "d5f85d6b07fa6e0f",
      "source": "7bd97edf7e27c2d2",
      "sourceOutput": "output",
      "target": "9a0b53fac1248b15",
      "targetInput": "input"
    },
    {
      "id": "60f041ecc88ad248",
      "source": "9a0b53fac1248b15",
      "sourceOutput": "output",
      "target": "5ea9c8fcc15f3fce",
      "targetInput": "input"
    }
  ]
};