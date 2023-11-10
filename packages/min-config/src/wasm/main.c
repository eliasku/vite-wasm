// #include <stdio.h>

#define EXPORT __attribute__((visibility("default")))

EXPORT void update(double timestamp);

double prev_ts;

void update(double timestamp) {
    // printf("dt: %lf", timestamp - prev_ts);
    prev_ts = timestamp;
}
