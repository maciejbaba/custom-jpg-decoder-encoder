# Custom JPG Decoder/Encoder

A TypeScript-based custom implementation for decoding and encoding JPG/JPEG images from scratch.

## Overview

This project implements a custom JPG decoder and encoder in TypeScript, providing low-level access to JPEG file format processing. The implementation focuses on understanding and manipulating the JPEG file structure, including signature validation and segment parsing.

## Features

- ✅ JPG signature validation
- 🚧 SOF (Start of Frame) marker detection
- 🔄 Custom decoding/encoding pipeline (in development)

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- TypeScript

## Installation

1. Clone the repository:
```bash
git clone https://github.com/maciejbaba/custom-jpg-decoder-encoder.git
cd custom-jpg-decoder-encoder
```

2. Install dependencies:
```bash
npm install
```

## Usage

Currently, the project includes basic JPG signature validation functionality:

```bash
# Run with ts-node
npx ts-node index.ts
```

The application will:
1. Read the `test.jpg` file
2. Validate the JPG signature (0xFF, 0xD8, 0xFF)
3. Output the file data for analysis

## Project Structure

```
├── index.ts          # Main application entry point
├── test.jpg          # Sample JPG file for testing
├── package.json      # Project dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # Project documentation
```

## Development

### Building the Project

The project uses TypeScript with the following configuration:
- Target: ES2016
- Module: CommonJS
- Strict mode enabled

### Current Implementation

The current implementation includes:

- **JPG Signature Detection**: Validates the first 3 bytes (0xFF, 0xD8, 0xFF)
- **SOF Markers**: Defines baseline and progressive DCT markers
- **Buffer Processing**: Converts file data to Uint8Array for byte-level manipulation

### Next Steps

- [ ] Implement complete JPG header parsing
- [ ] Add support for various JPEG segments (SOF, DHT, DQT, etc.)
- [ ] Implement DCT decoding
- [ ] Add encoding capabilities
- [ ] Support for different JPEG variants

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Technical References

- [JPEG File Interchange Format Specification](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)
- [JPEG File Format Overview](https://en.wikipedia.org/wiki/JPEG_File_Interchange_Format)

## Author

This project is part of learning and understanding image processing algorithms at a low level.