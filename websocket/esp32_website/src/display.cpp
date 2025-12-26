#include "display.h"

// -------------------------
// Display Pin Configuration
// -------------------------
const int clk = 22;   // SCK
const int latch = 21; // RCK 
const int data = 23;  // DIO

// -------------------------
// 7-segment encoding for digits 0–9, plus blank
// -------------------------
byte value[] = { 
  B11000000, // 0
  B11111001, // 1
  B10100100, // 2
  B10110000, // 3
  B10011001, // 4
  B10010010, // 5
  B10000010, // 6
  B11111000, // 7
  B10000000, // 8
  B10010000, // 9
  B11111111  // blank
};

// -------------------------
// Segment select bits
// -------------------------
byte digit[] = {
  B00000001, // leftmost
  B00000010,
  B00000100,
  B00001000,
  B00010000,
  B00100000,
  B01000000,
  B10000000  // rightmost
}; 

// -------------------------
// Display State Variables
// -------------------------
int numberToDisplay = 0;

// -------------------------
// Display Initialization
// -------------------------
void displayInit() {
  pinMode(clk, OUTPUT);
  pinMode(latch, OUTPUT);
  pinMode(data, OUTPUT);
}

// -------------------------
// Set Number to Display
// -------------------------
void setDisplayNumber(int number) {
  numberToDisplay = number;
}

// -------------------------
// Update Display (call frequently in loop)
// -------------------------
void displayUpdate() {
  byte chr;
  
  // Convert number to string
  char str[9]; // 8 digits + null terminator
  sprintf(str, "%8d", numberToDisplay); // right-align number, pad with spaces

  // Update display (multiplexing)
  for(int y = 0; y < 8; y++) {
    if (str[y] == ' ') {
      chr = value[10]; // blank
    } else {
      chr = value[str[y] - '0']; // convert char to index
    }

    digitalWrite(latch, LOW);
    shiftOut(data, clk, MSBFIRST, digit[y]); // select segment
    shiftOut(data, clk, MSBFIRST, chr);      // display char
    digitalWrite(latch, HIGH);
  }
}
