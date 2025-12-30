#ifndef HASH_H
#define HASH_H

#include <cstdint>
#include <Arduino.h>

// Hash a client ID string to a 32-bit key
uint32_t hashClientId(const char *str);

// Add a delta value to the hash table entry for a given key
void hashPut(uint32_t key, long delta);

// Get the sum of all values in the hash table
long getGlobalTotal();

#endif // HASH_H
