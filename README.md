# yaml-verify

yaml-verify is a command-line utility designed to validate YAML files, ensuring they are free from syntax errors and duplicate keys, thus enhancing the integrity of your YAML configurations.

## Features

- **Syntax Validation**: Ensures your YAML files are syntactically correct.
- **Unique Key Validation**: Checks for and prevents duplicate keys at each level in your YAML files.
- **CLI Flexibility**: Easy-to-use command-line interface to validate files or directories containing YAML files.
- **Cross-Platform**: Works on Windows, macOS, and Linux.

## Installation

To install yaml-verify globally, use npm:

```bash
npm install -g yaml-verify
```

## Usage

To validate a single YAML file:

```bash
yaml-verify path/to/file.yaml
```

To validate multiple YAML files:

```bash
yaml-verify path/to/file1.yaml path/to/file2.yaml
```

To validate all YAML files in a directory:

```bash
yaml-verify path/to/directory
```

## Options

- `-h, --help`: Display help information.
- `-v, --version`: Display the current version of yaml-verify.

## Examples

Validate a single YAML file:

```bash
yaml-verify config.yaml
```

Validate multiple YAML files:

```bash
yaml-verify config.yaml data.yaml
```

Validate all YAML files in a directory:

```bash
yaml-verify /path/to/configs/
```

## Contributing

Contributions to yaml-verify are welcome! Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the [MIT License](LICENSE).

## Support

If you encounter any issues or have any questions about yaml-verify, please file an issue on the GitHub repository.
