#include <cstdint>

#define TABLE_SIZE 32

uint32_t hashClientId(const char *str) {
  uint32_t hash = 5381;
  while (*str) {
    hash = ((hash << 5) + hash) + *str++;
  }
  return hash;
}

struct  HashEntry
{
    uint32_t key;
    long value;
    bool used;
};

HashEntry table[TABLE_SIZE];

int findSlot(uint32_t key) {
  int index = key % TABLE_SIZE;

  for (int i = 0; i < TABLE_SIZE; i++) {
    int probe = (index + i) % TABLE_SIZE;

    if (!table[probe].used || table[probe].key == key) {
      return probe;
    }
  }
  return -1; // table full
}

void hashPut(uint32_t key, long delta) {
  int idx = findSlot(key);
  if (idx < 0) {
    return;
  }

  if (!table[idx].used) {
    table[idx].key = key;
    table[idx].value = 0;
    table[idx].used = true;
  }

  table[idx].value = delta;
}

long getGlobalTotal() {
  long sum = 0;
  for (int i = 0; i < TABLE_SIZE; i++) {
    if (table[i].used) sum += table[i].value;
  }
  return sum;
}
