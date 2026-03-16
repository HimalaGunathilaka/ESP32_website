// swagger.js
const YAML = require("yamljs");
const path = require("path");

const swaggerSpec = YAML.load(
    path.join(__dirname, "docs/swagger.yaml")
);

module.exports = swaggerSpec;
