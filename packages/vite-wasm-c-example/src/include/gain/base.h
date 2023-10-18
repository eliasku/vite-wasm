#ifndef GAIN_BASE_H
#define GAIN_BASE_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

#define IMPORT extern
#define EXPORT __attribute__((visibility("default")))
#define AS(x) __asm__(#x)

#endif // GAIN_BASE_H
