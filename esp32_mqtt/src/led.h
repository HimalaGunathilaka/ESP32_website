#ifndef LED_H
#define LED_H

#include <FastLED.h>

// -------------------------
// LED Matrix Configuration
// -------------------------
#define LED_PIN 32
#define NUM_LEDS 64
#define BRIGHTNESS 64
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
#define MATRIX_WIDTH 8
#define MATRIX_HEIGHT 8

// -------------------------
// LED Matrix Functions
// -------------------------
void initLED();
void clearLED();
void showLED();
void setPixel(int x, int y, CRGB color);
void setRow(int row, CRGB color);
void setColumn(int col, CRGB color);
void fillMatrix(CRGB color);
int XY(int x, int y);
int XY_serpentine(int x, int y);

// External access to LED array if needed
extern CRGB leds[NUM_LEDS];

#endif
