/**
 * JPEG Parser and Custom Format Converter
 * This code reads JPEG data and extracts information needed for a custom format
 */

// Types for JPEG processing
interface JpegDimensions {
  width: number;
  height: number;
  precision: number;
  components: number;
}

interface JpegSegment {
  marker: string;
  offset: number;
  length: number;
  data?: Uint8Array;
  type?: string;
  dimensions?: JpegDimensions;
  headerLength?: number;
  dataLength?: number;
  totalLength?: number;
}

interface JpegMetadata {
  segments: JpegSegment[];
  dimensions: JpegDimensions | null;
  hasExif: boolean;
  hasJFIF: boolean;
}

interface CustomImageFormat {
  signature: string;
  version: number;
  originalFormat: string;
  dimensions: JpegDimensions | null;
  originalMetadata: {
    hasExif: boolean;
    hasJFIF: boolean;
    segmentCount: number;
  };
  imageData: Uint8Array;
}

// Marker definitions for JPEG format
const MARKERS = {
  SOI: 0xd8,   // Start of Image
  SOF0: 0xc0,  // Start of Frame (Baseline DCT)
  SOF2: 0xc2,  // Start of Frame (Progressive DCT)
  DHT: 0xc4,   // Define Huffman Table
  DQT: 0xdb,   // Define Quantization Table
  DRI: 0xdd,   // Define Restart Interval
  SOS: 0xda,   // Start of Scan
  APP0: 0xe0,  // JFIF Application segment
  APP1: 0xe1,  // EXIF Application segment
  COM: 0xfe,   // Comment
  EOI: 0xd9,   // End of Image
};

// Frame type markers that contain dimension information
const SOF_MARKERS = [
  MARKERS.SOF0, 
  MARKERS.SOF2,
];

const JPG_SIGNATURE = [0xff, 0xd8, 0xff];

/**
 * Checks if the file has a valid JPEG signature
 * @param data - The raw file data
 * @returns True if the data begins with a valid JPEG signature
 */
function isValidJpegSignature(data: Uint8Array): boolean {
  if (data.length < 3) {
    return false;
  }
  
  return data[0] === JPG_SIGNATURE[0] && 
         data[1] === JPG_SIGNATURE[1] && 
         data[2] === JPG_SIGNATURE[2];
}

/**
 * Extracts metadata from a JPEG file
 * @param data - The raw JPEG file data
 * @returns A structured object containing JPEG metadata
 * @throws Error if the JPEG format is invalid
 */
function extractJpegMetadata(data: Uint8Array): JpegMetadata {
  // Verify JPEG signature
  if (!isValidJpegSignature(data)) {
    throw new Error('Invalid JPEG signature: File does not start with FF D8 FF');
  }

  const metadata: JpegMetadata = {
    segments: [],
    dimensions: null,
    hasExif: false,
    hasJFIF: false,
  };

  let offset = 2; // Start after signature
  
  // Parse segments
  while (offset < data.length - 1) {
    // Check for valid marker prefix
    if (data[offset] !== 0xff) {
      console.warn(`Non-marker byte found at offset ${offset}: 0x${data[offset].toString(16)}`);
      offset++;
      continue;
    }
    
    const marker = data[offset + 1];
    
    // Skip padding bytes (0xFF, 0x00)
    if (marker === 0x00) {
      offset += 2;
      continue;
    }
    
    // Check if we've reached the end of the image
    if (marker === MARKERS.EOI) {
      metadata.segments.push({
        marker: 'EOI',
        offset,
        length: 2,
      });
      break;
    }
    
    // Handle SOS segment specially since it's followed by image data
    if (marker === MARKERS.SOS) {
      if (offset + 4 >= data.length) {
        throw new Error(`Incomplete SOS marker at offset ${offset}`);
      }

      const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
      
      if (offset + 2 + segmentLength > data.length) {
        throw new Error(`SOS segment at offset ${offset} extends beyond file end`);
      }
      
      const scanStart = offset + 2 + segmentLength;
      
      // Find EOI marker after SOS
      let scanEnd = scanStart;
      let foundEOI = false;
      
      while (scanEnd < data.length - 1) {
        // Look for FF D9 (EOI marker)
        if (data[scanEnd] === 0xff && data[scanEnd + 1] === MARKERS.EOI) {
          foundEOI = true;
          break;
        }
        scanEnd++;
      }
      
      if (!foundEOI) {
        throw new Error('Could not find EOI marker after SOS segment');
      }
      
      metadata.segments.push({
        marker: 'SOS',
        offset,
        length: scanEnd - offset,
        headerLength: segmentLength + 2,
        dataLength: scanEnd - scanStart,
        totalLength: scanEnd - offset,
      });
      
      offset = scanEnd;
      continue;
    }
    
    // Parse normal segment with length bytes
    if (offset + 4 >= data.length) {
      throw new Error(`Incomplete segment at offset ${offset}`);
    }
    
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    
    if (segmentLength < 2) {
      throw new Error(`Invalid segment length (${segmentLength}) at offset ${offset}`);
    }
    
    if (offset + 2 + segmentLength > data.length) {
      throw new Error(`Segment at offset ${offset} extends beyond file end`);
    }
    
    const segmentData = data.slice(offset + 4, offset + 2 + segmentLength);
    const markerHex = marker.toString(16).toUpperCase().padStart(2, '0');
    const segmentInfo: JpegSegment = {
      marker: `0x${markerHex}`,
      offset,
      length: segmentLength + 2,
      data: segmentData,
    };
    
    // Extract dimensions from SOF segments
    if (SOF_MARKERS.includes(marker)) {
      if (segmentData.length < 6) {
        throw new Error(`SOF segment too short at offset ${offset}`);
      }
      
      const precision = segmentData[0];
      const height = (segmentData[1] << 8) | segmentData[2];
      const width = (segmentData[3] << 8) | segmentData[4];
      const components = segmentData[5];
      
      const dimensions = { width, height, precision, components };
      metadata.dimensions = dimensions;
      segmentInfo.dimensions = dimensions;
    }
    
    // Check for EXIF data in APP1 segment
    if (marker === MARKERS.APP1 && segmentData.length >= 6) {
      const exifSignature = 'Exif\0\0';
      const segmentStr = String.fromCharCode(...segmentData.slice(0, 6));
      if (segmentStr === exifSignature) {
        metadata.hasExif = true;
        segmentInfo.type = 'EXIF';
      }
    }
    
    // Check for JFIF data in APP0 segment
    if (marker === MARKERS.APP0 && segmentData.length >= 5) {
      const jfifSignature = 'JFIF\0';
      const segmentStr = String.fromCharCode(...segmentData.slice(0, 5));
      if (segmentStr === jfifSignature) {
        metadata.hasJFIF = true;
        segmentInfo.type = 'JFIF';
      }
    }
    
    metadata.segments.push(segmentInfo);
    offset += 2 + segmentLength;
  }
  
  // Ensure we found dimensions
  if (!metadata.dimensions && metadata.segments.length > 0) {
    console.warn('No SOF segment found - image dimensions unknown');
  }
  
  return metadata;
}

/**
 * Extracts the raw image data from the JPEG
 * @param data - The raw JPEG file data
 * @param metadata - The parsed JPEG metadata
 * @returns The raw image data between SOS and EOI markers
 * @throws Error if SOS segment cannot be found
 */
function extractImageData(data: Uint8Array, metadata: JpegMetadata): Uint8Array {
  // Find the SOS segment
  const sosSegment = metadata.segments.find((seg) => seg.marker === 'SOS');
  
  if (!sosSegment || !sosSegment.headerLength || !sosSegment.dataLength) {
    throw new Error('Could not find valid SOS segment');
  }
  
  // Extract image data from the SOS segment to EOI
  const startOffset = sosSegment.offset + sosSegment.headerLength;
  const endOffset = startOffset + sosSegment.dataLength;
  
  if (startOffset >= data.length || endOffset > data.length) {
    throw new Error('Image data extraction failed: Invalid offsets');
  }
  
  return data.slice(startOffset, endOffset);
}

/**
 * Converts JPEG data to a custom format
 * @param data - The raw JPEG file data
 * @returns A structured object representing the custom format
 */
function convertToCustomFormat(data: Uint8Array): CustomImageFormat {
  const metadata = extractJpegMetadata(data);
  
  // Custom format structure
  const customFormat: CustomImageFormat = {
    signature: 'CUSTOMIMG',
    version: 1,
    originalFormat: 'JPEG',
    dimensions: metadata.dimensions,
    originalMetadata: {
      hasExif: metadata.hasExif,
      hasJFIF: metadata.hasJFIF,
      segmentCount: metadata.segments.length,
    },
    imageData: extractImageData(data, metadata),
  };
  
  return customFormat;
}

/**
 * Serializes the custom format to a binary buffer
 * @param customFormat - The custom format object
 * @returns A Uint8Array containing the serialized data
 */
function serializeCustomFormat(customFormat: CustomImageFormat): Uint8Array {
  // Define header size and calculate total size
  const headerSize = 1024; // Fixed header size
  const totalSize = headerSize + customFormat.imageData.length;
  const buffer = new Uint8Array(totalSize);
  
  // Create a DataView for easier binary writing
  const view = new DataView(buffer.buffer);
  
  // Write signature (ASCII)
  const encoder = new TextEncoder();
  const signatureBytes = encoder.encode(customFormat.signature);
  buffer.set(signatureBytes, 0);
  
  // Write version (32-bit integer) at offset 16
  view.setUint32(16, customFormat.version, false); // big-endian
  
  // Write original format string at offset 20
  const formatBytes = encoder.encode(customFormat.originalFormat);
  buffer.set(formatBytes, 20);
  
  // Write dimensions at offset 32 if available
  if (customFormat.dimensions) {
    view.setUint16(32, customFormat.dimensions.width, false);
    view.setUint16(34, customFormat.dimensions.height, false);
    view.setUint8(36, customFormat.dimensions.precision);
    view.setUint8(37, customFormat.dimensions.components);
  }
  
  // Write metadata flags at offset 40
  view.setUint8(40, customFormat.originalMetadata.hasExif ? 1 : 0);
  view.setUint8(41, customFormat.originalMetadata.hasJFIF ? 1 : 0);
  view.setUint16(42, customFormat.originalMetadata.segmentCount, false);
  
  // Write image data size at offset 48
  view.setUint32(48, customFormat.imageData.length, false);
  
  // Write image data after header
  buffer.set(customFormat.imageData, headerSize);
  
  return buffer;
}

/**
 * Save the custom format to a file
 * @param customFormat - The custom format object
 * @param outputFilePath - The path to save the file to
 * @returns The serialized buffer
 */
function saveCustomFormat(customFormat: CustomImageFormat, outputFilePath: string): Uint8Array {
  const buffer = serializeCustomFormat(customFormat);
  
  // In Node.js you would use fs.writeFileSync here
  // fs.writeFileSync(outputFilePath, buffer);
  
  return buffer;
}

/**
 * Process a JPEG file: extract metadata, convert to custom format, and save
 * @param inputFilePath - The path to the input JPEG file
 * @param outputFilePath - The path to save the custom format file
 * @returns An object containing the processing results
 */
function processJpeg(inputFilePath: string, outputFilePath: string) {
  // In a Node.js environment:
  // const fs = require('fs');
  // const input = fs.readFileSync(inputFilePath);
  // const buffer = Buffer.from(input);
  // const data = new Uint8Array(buffer);
  
  // For browser or testing environments:
  const data = new Uint8Array(/* your data here */); // Replace with actual data
  
  try {
    console.log('Processing JPEG file...');
    
    // Extract metadata
    const metadata = extractJpegMetadata(data);
    console.log('JPEG Dimensions:', metadata.dimensions);
    console.log('Segments found:', metadata.segments.length);
    
    // Convert to custom format
    const customFormat = convertToCustomFormat(data);
    
    // Save to file
    const outputBuffer = saveCustomFormat(customFormat, outputFilePath);
    console.log('Custom format saved successfully');
    
    return {
      success: true,
      metadata,
      customFormat,
      outputBuffer,
    };
  } catch (error) {
    console.error('Error processing JPEG:', error);
    return {
      success: false,
      error,
    };
  }
}

/**
 * Node.js implementation of processJpegFile that handles actual file I/O
 * @param inputFilePath - The path to the input JPEG file
 * @param outputFilePath - The path to save the custom format file
 * @returns An object containing the processing results
 */
function processJpegFile(inputFilePath: string, outputFilePath: string) {
  try {
    // Uncomment in Node.js environment:
    /*
    const fs = require('fs');
    const input = fs.readFileSync(inputFilePath);
    const data = new Uint8Array(input);
    
    const metadata = extractJpegMetadata(data);
    const customFormat = convertToCustomFormat(data);
    const outputBuffer = serializeCustomFormat(customFormat);
    
    fs.writeFileSync(outputFilePath, outputBuffer);
    */
    
    console.log(`Processed ${inputFilePath} and saved to ${outputFilePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error processing JPEG file:', error);
    return { 
      success: false, 
      error 
    };
  }
}

// Export functions for use in other modules
export {
  extractJpegMetadata,
  convertToCustomFormat,
  serializeCustomFormat,
  saveCustomFormat,
  processJpeg,
  processJpegFile,
  // Export types too
  type JpegDimensions,
  type JpegSegment,
  type JpegMetadata,
  type CustomImageFormat,
};
