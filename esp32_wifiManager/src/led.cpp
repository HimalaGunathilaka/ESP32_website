#include "led.h"

// -------------------------
// LED Array
// -------------------------
CRGB leds[NUM_LEDS];

// -------------------------
// Total time tracking
// -------------------------
long total_time;

// -------------------------
// Initialize LED Matrix
// -------------------------
void initLED() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
}

// -------------------------
// Clear all LEDs
// -------------------------
void clearLED() {
  FastLED.clear();
}

// -------------------------
// Show/update LED display
// -------------------------
void showLED() {
  FastLED.show();
}

// -------------------------
// Map 2D coordinates to 1D index for straight wiring
// -------------------------
int XY(int x, int y) {
  if (x < 0 || x >= MATRIX_WIDTH || y < 0 || y >= MATRIX_HEIGHT) {
    return -1; // Out of bounds
  }
  return y * MATRIX_WIDTH + x;
}

// -------------------------
// Map 2D coordinates to 1D index for serpentine (zig-zag) wiring
// -------------------------
int XY_serpentine(int x, int y) {
  if (x < 0 || x >= MATRIX_WIDTH || y < 0 || y >= MATRIX_HEIGHT) {
    return -1; // Out of bounds
  }
  if (y % 2 == 0) {  // even row: left-to-right
    return y * MATRIX_WIDTH + x;
  } else {  // odd row: right-to-left
    return y * MATRIX_WIDTH + (MATRIX_WIDTH - 1 - x);
  }
}

// -------------------------
// Set a single pixel at (x, y) to a color
// -------------------------
void setPixel(int x, int y, CRGB color) {
  int index = XY_serpentine(x, y);
  if (index >= 0) {
    leds[index] = color;
  }
}

// -------------------------
// Set an entire row to a specific color
// -------------------------
void setRow(int row, CRGB color) {
  if (row < 0 || row >= MATRIX_HEIGHT) return;
  
  for (int x = 0; x < MATRIX_WIDTH; x++) {
    leds[XY_serpentine(x, row)] = color;
  }
}

// -------------------------
// Set an entire column to a specific color
// -------------------------
void setColumn(int col, CRGB color) {
  if (col < 0 || col >= MATRIX_WIDTH) return;
  
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    leds[XY_serpentine(col, y)] = color;
  }
}

// -------------------------
// Fill entire matrix with a color
// -------------------------
void fillMatrix(CRGB color) {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
  }
}