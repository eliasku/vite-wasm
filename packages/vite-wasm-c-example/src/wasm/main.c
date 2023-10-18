#include <gain/base.h>

IMPORT void print(double number) AS(print);
EXPORT void update(double timestamp) AS(update);

double prev_ts;

void update(double timestamp) {
    print(timestamp - prev_ts);
    prev_ts = timestamp;
}