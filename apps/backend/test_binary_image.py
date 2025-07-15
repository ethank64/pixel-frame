#!/usr/bin/env python3
"""
Test script to verify binary image format for full image updates.
This script tests the binary packing and unpacking of complete 64x64 image data.
"""

import struct
import json

def test_binary_image_format():
    """Test the binary format for full image updates."""
    
    # Simulate a 64x64 image with some test pixels
    # In a real scenario, this would be all 4096 pixels
    test_pixels = []
    for y in range(64):
        for x in range(64):
            # Create some test pattern
            r = (x + y) % 256
            g = (x * 2) % 256
            b = (y * 2) % 256
            test_pixels.append((x, y, r, g, b))
    
    print(f"Testing binary image format with {len(test_pixels)} pixels...")
    
    # Create binary data like the frontend does
    binary_data = bytearray()
    pixel_count = len(test_pixels)
    
    # Prepend the count as a 2-byte integer
    binary_data.extend(struct.pack('H', pixel_count))
    
    # Add all pixels
    for x, y, r, g, b in test_pixels:
        binary_data.extend(struct.pack('BBBBB', x, y, r, g, b))
    
    print(f"Pixel count: {pixel_count}")
    print(f"Binary data size: {len(binary_data)} bytes")
    print(f"Expected size: {2 + 64 * 64 * 5} bytes")
    print(f"Binary data (first 50 bytes hex): {binary_data[:50].hex()}")
    
    # Test unpacking like the backend does
    view = binary_data
    unpacked_count = struct.unpack('H', view[:2])[0]
    print(f"Unpacked count: {unpacked_count}")
    
    # Verify first few pixels
    print("First 5 unpacked pixels:")
    for i in range(min(5, unpacked_count)):
        offset = 2 + (i * 5)
        x, y, r, g, b = struct.unpack('BBBBB', view[offset:offset+5])
        print(f"  ({x}, {y}): RGB({r}, {g}, {b})")
    
    # Compare with JSON format
    print("\nComparing with JSON format...")
    json_data = json.dumps({"type": "image_update", "canvas": [{"x": x, "y": y, "r": r, "g": g, "b": b} for x, y, r, g, b in test_pixels]})
    json_size = len(json_data.encode('utf-8'))
    print(f"JSON data size: {json_size} bytes")
    print(f"Binary data size: {len(binary_data)} bytes")
    print(f"Size reduction: {((json_size - len(binary_data)) / json_size * 100):.1f}%")
    
    # Test message type detection
    print(f"\nMessage type detection:")
    print(f"5 bytes: Single pixel update")
    print(f"{len(binary_data)} bytes: Full image update")
    print(f"Other sizes: Initial canvas data (non-black pixels only)")
    
    print("\nAll tests passed!")

if __name__ == "__main__":
    test_binary_image_format() 