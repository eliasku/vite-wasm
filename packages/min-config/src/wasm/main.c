#define IMPORT extern
#define EXPORT __attribute__((visibility("default")))
#define AS(x) __asm__(#x)

IMPORT void print(double number) AS(print);
EXPORT void update(double timestamp) AS(update);

double prev_ts;

void update(double timestamp) {
    print(timestamp - prev_ts);
    prev_ts = timestamp;
}
