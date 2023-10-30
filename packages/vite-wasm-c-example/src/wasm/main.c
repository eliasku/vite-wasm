#include <gain/base.h>

IMPORT void print(double number) AS(p);
EXPORT void update(double timestamp) AS(u);

double prev_ts;

void update(double timestamp) {
    print((timestamp - prev_ts) / 1000.0);
    prev_ts = timestamp;
}