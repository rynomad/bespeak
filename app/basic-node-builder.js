export default {
  "id": "be9c6d49-59aa-4e42-8df2-cf3103c69a46",
  "name": "One Shot",
  "nodes": [
    {
      "id": "eff7771f51b19037",
      "key": "flow-input",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 766.4961875,
      "y": 98.25
    },
    {
      "id": "bdac393053245942",
      "key": "chat-gpt",
      "version": 16,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "role": "user",
        "placement": "append",
        "joinStrategy": "none",
        "n": 1,
        "temperature": 0.3,
        "model": "gpt-4",
        "history": 0,
        "call": true,
        "context": "none",
        "prompt": "To fulfill the desire I just expressed, I will guide you through the process of creating a node in the context we're working in. \n\nYou will write in pure vanilla javascript (no typescript or jsx) \nYou will import any dependencies from esm.sh, specifying versions.\nYou will write all code such that it will run in the browser environment. \n\nstart by defining any necessary json schemas \nAll schemas are optional, but must be named exactly as below.\nIf a schema is unnecessary, omit it entirely.\nDo not include $schema property.\n\ninput: any input value that will change frequently (user or process input)\nconfig: any options or settings that add flexibility to the use of the node but be relatively fixed across inputs.\n\nYou MUST supply default values for any required properties on the input or config schema.\n\nkeys: any api keys necessary for third party services\noutput: the output schema if data is processed or retrieved. If all I want to do is visualize something, you can omit this schema.\n\nDo not do anything more than define the schemas for now.\nMake liberal use of titles and description, and any other additional data in valid JSON schemas to ease understandability of the data structure. use more descriptive titles than \"input\" \"config\" and \"output\", make them relevant to the task at hand. "
      },
      "x": 766.4961875,
      "y": 637.2421875
    },
    {
      "id": "d9546bdc63b10e73",
      "key": "chat-gpt",
      "version": 16,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "role": "user",
        "placement": "append",
        "joinStrategy": "none",
        "n": 1,
        "temperature": 0.3,
        "model": "gpt-4",
        "history": 0,
        "call": true,
        "context": "none",
        "prompt": "now define a function with the signature `_process(input, config, keys)` that has a return value matching the output schema you defined. If my desire is merely to visualize something, and I don't mention needing to get or transform data, you can just say so and we'll move on to the visualization.\n \nRemember, this code is for the browser, use browser builtins. Do not use node-js libraries.\nDon't forget that the function must include an underscore: `_process`\nRemember, import npm libraries from `https://esm.sh` at the top of the file."
      },
      "x": 766.4961875,
      "y": 1508.73
    },
    {
      "id": "52fd78c8f7514adb",
      "key": "chat-gpt",
      "version": 16,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "role": "user",
        "placement": "append",
        "joinStrategy": "none",
        "n": 1,
        "temperature": 0.3,
        "model": "gpt-4",
        "history": 0,
        "call": true,
        "context": "none",
        "prompt": "Now to create a `render` function. we're using lit elements here\n\nthis.input will be the input value, or undefined.\nthis.output will be the output value, or undefined.\n\nMake sure to guard against these values being undefined so you don't throw errors in that case.\n\nGive me an appropriate render function, and try to give it an elegant, clean aesthetic. Don't forget to define any relevant css"
      },
      "x": 766.4961875,
      "y": 2380.2221875
    },
    {
      "id": "d02174ae5405c9d7",
      "key": "code-parser",
      "version": 5,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "language": "javascript"
      },
      "x": 766.4961875,
      "y": 3898.15
    },
    {
      "id": "190380dd588f979f",
      "key": "custom-node",
      "version": 8,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 955.8671875,
      "y": 4100.022187500001
    },
    {
      "id": "336af4e992ebbdc1",
      "key": "chat-gpt",
      "version": 17,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "role": "user",
        "placement": "append",
        "joinStrategy": "none",
        "n": 1,
        "temperature": 0.3,
        "model": "gpt-4",
        "history": 0,
        "call": true,
        "context": "values",
        "prompt": "Now bring it all together by creating a child class of BespeakComponent. BespeakComponent is a LitElement, but it takes care of defining reactive properties and constructor and lifecycle hook. All you need to do is set any schemas to their respective static properties, and define optional `_process` and `render` functions. The rest is taken care of for you!\n\nExample:\n```javascript\nimport {html, css} from \"https://esm.sh/lit@2.8.0\"\nimport BespeakComponent from \"./component.js\"\n\nexport default MyNode extends BespeakComponent {\n  static input = // input schema\n  static output.= // output schema\n\n  async process(input, config, keys){\n     // implementation\n  }\n\n  render(){ \n  }\n}\n```\n\nBe sure not to forget any imports (third party libraries should be imported from esm.sh) and if you define a render function, make sure there's some decent css styiling.\n\nBe sure not to forget any css!\n\nDO NOT register the component in the `customElements` registry. This will be taken care of for you.\n\nYou MUST include all source code, redefining and rewriting anything you wrote before, with no omissions.\n\nRemember, this code is to be written for the browser environment\nRemember, import BespeakComponent from relative path \"./component.js\".\nRemember, import all npm dependencies from `https://esm.sh` at the top of the file\n\nThe name you choose for your class will be used as it's title in a list of components, so choose something short but still decently descriptive (avoid using the word 'node' or 'component' in the class name).\n\nIf I give you an error message, it means that a prior iteration of this code has thrown that error. take care to make sure not to introduce this error message again.\n\nDO NOT REGISTER THE COMPONENT IN THE CUSTOM ELEMENTS REGISTRY.\n\nRemember, this is code for the browser. Do not use any node.js libraries."
      },
      "x": 766.4961875,
      "y": 3359.1621875
    },
    {
      "id": "9574fedf0db2d547",
      "key": "debug",
      "version": 1,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 383.6871875,
      "y": 4620.8521875
    },
    {
      "id": "1e40048153230566",
      "key": "gate",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "stop": false,
        "expression": "input.every(i => i.value instanceof Error);"
      },
      "x": 892.9791875,
      "y": 4313.6721875
    },
    {
      "id": "65b47ab59a2292eb",
      "key": "gate",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda",
        "stop": false,
        "expression": "input.every(i => !(i.value instanceof Error));"
      },
      "x": 1011.7851875,
      "y": 4312.5021875
    },
    {
      "id": "57c205e10c3c20bd",
      "key": "flow-output",
      "version": 2,
      "config": {
        "adapterFlow": "fc3e4476-b2ff-41e0-89fd-b58dfaa3dfda"
      },
      "x": 864.7421875,
      "y": 4597.86
    }
  ],
  "connections": [
    {
      "id": "55b71d9616196dd1",
      "source": "d9546bdc63b10e73",
      "sourceOutput": "output",
      "target": "52fd78c8f7514adb",
      "targetInput": "input"
    },
    {
      "id": "7f53adf6b11133cc",
      "source": "d02174ae5405c9d7",
      "sourceOutput": "output",
      "target": "190380dd588f979f",
      "targetInput": "input"
    },
    {
      "id": "44963150e54ef7d0",
      "source": "eff7771f51b19037",
      "sourceOutput": "output",
      "target": "bdac393053245942",
      "targetInput": "input"
    },
    {
      "id": "4acd7e10fb973011",
      "source": "bdac393053245942",
      "sourceOutput": "output",
      "target": "d9546bdc63b10e73",
      "targetInput": "input"
    },
    {
      "id": "63e9ac4db2ee0ac7",
      "source": "336af4e992ebbdc1",
      "sourceOutput": "output",
      "target": "d02174ae5405c9d7",
      "targetInput": "input"
    },
    {
      "id": "47ec6d52140fe2af",
      "source": "190380dd588f979f",
      "sourceOutput": "output",
      "target": "1e40048153230566",
      "targetInput": "input"
    },
    {
      "id": "efad53c3bd65802e",
      "source": "190380dd588f979f",
      "sourceOutput": "output",
      "target": "65b47ab59a2292eb",
      "targetInput": "input"
    },
    {
      "id": "6f133d7344d9b64a",
      "source": "d02174ae5405c9d7",
      "sourceOutput": "output",
      "target": "65b47ab59a2292eb",
      "targetInput": "input"
    },
    {
      "id": "21869ff273c90ca9",
      "source": "65b47ab59a2292eb",
      "sourceOutput": "output",
      "target": "9574fedf0db2d547",
      "targetInput": "input"
    },
    {
      "id": "971cfe326b48e129",
      "source": "65b47ab59a2292eb",
      "sourceOutput": "output",
      "target": "57c205e10c3c20bd",
      "targetInput": "input"
    },
    {
      "id": "8cbe9e36d07c55da",
      "source": "52fd78c8f7514adb",
      "sourceOutput": "output",
      "target": "336af4e992ebbdc1",
      "targetInput": "input"
    },
    {
      "id": "8a0290820266bd6d",
      "source": "1e40048153230566",
      "sourceOutput": "output",
      "target": "336af4e992ebbdc1",
      "targetInput": "input"
    }
  ]
};