/**
 * @file led.cpp
 * @author Himala Gunathilaka
 * @brief This file is for 8 by 8 led matrix controlling.
 * @version 0.1
 * @date 2026-03-17
 * 
 * @copyright Copyright (c) 2026
 * 
 */
#include "led.h"

/**
 * @brief LED array
 * 
 */
CRGB leds[NUM_LEDS];

/**
 * @brief Total tracked time
 * 
 */
long total_time;

/**
 * @brief Initialize the led matrix
 * 
 */
void initLED() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
}

/**
 * @brief Turn off all the leds.
 * 
 */
void clearLED() {
  FastLED.clear();
}

/**
 * @brief Turn on the selected leds.
 * 
 */
void showLED() {
  FastLED.show();
}

/**
 * @brief Map 2D coordinates to 1D index for straight wiring
 * 
 * @param x x-axis location
 * @param y y-axis location
 * @return int the led number corresponds to the (x,y) location. 
 */
int XY(int x, int y) {
  if (x < 0 || x >= MATRIX_WIDTH || y < 0 || y >= MATRIX_HEIGHT) {
    return -1; // Out of bounds
  }
  return y * MATRIX_WIDTH + x;
}

/**
 * @brief Map 2D coordinates to 1D index for serpentine (zig-zag) wiring
 * 
 * @param x x-axis location
 * @param y y-axis location
 * @return int 
 */
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

/**
 * @brief Set a single pixel at (x, y) to a color
 * 
 * @param x x-axis location
 * @param y y-axis location
 * @param color colur to be set in that location
 */
void setPixel(int x, int y, CRGB color) {
  int index = XY_serpentine(x, y);
  if (index >= 0) {
    leds[index] = color;
  }
}

/**
 * @brief Set an entire row to a specific color;
 * 
 * @param row row number
 * @param color 
 */
void setRow(int row, CRGB color) {
  if (row < 0 || row >= MATRIX_HEIGHT) return;
  
  for (int x = 0; x < MATRIX_WIDTH; x++) {
    leds[XY_serpentine(x, row)] = color;
  }
}

/**
 * @brief Set an entire column to a specific color
 * 
 * @param col column number
 * @param color 
 */
void setColumn(int col, CRGB color) {
  if (col < 0 || col >= MATRIX_WIDTH) return;
  
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    leds[XY_serpentine(col, y)] = color;
  }
}

/**
 * @brief Fill entire matrix with a color
 * 
 * @param color 
 */
void fillMatrix(CRGB color) {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
  }
}