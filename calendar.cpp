// Usage: ./calendar [month year]   (defaults to current month)
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <ctime>

int dow(int y, int m, int d) {  // 0 = Sunday (Sakamoto's method)
    static const int t[] = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
    if (m < 3) y--;
    return (y + y / 4 - y / 100 + y / 400 + t[m - 1] + d) % 7;
}

int dim(int y, int m) {  // days in month
    static const int d[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    bool leap = y % 4 == 0 && (y % 100 || y % 400 == 0);
    return m == 2 && leap ? 29 : d[m - 1];
}

int main(int argc, char** argv) {
    assert(dow(2000, 1, 1) == 6 && dim(2024, 2) == 29 && dim(1900, 2) == 28);  // self-check

    time_t now = time(nullptr);
    tm* t = localtime(&now);
    int m = t->tm_mon + 1, y = t->tm_year + 1900;
    if (argc == 3) { m = atoi(argv[1]); y = atoi(argv[2]); }
    if (m < 1 || m > 12 || y < 1) { fprintf(stderr, "usage: %s [month 1-12] [year]\n", argv[0]); return 1; }

    static const char* names[] = {"January", "February", "March", "April", "May", "June", "July",
                                  "August", "September", "October", "November", "December"};
    printf("\n  %s %d\nSu Mo Tu We Th Fr Sa\n", names[m - 1], y);
    for (int i = 0; i < dow(y, m, 1); i++) printf("   ");
    for (int d = 1; d <= dim(y, m); d++) {
        bool today = d == t->tm_mday && m == t->tm_mon + 1 && y == t->tm_year + 1900;
        printf(today ? "%2d*" : "%2d ", d);  // * marks today
        if (dow(y, m, d) == 6) printf("\n");
    }
    printf("\n");
}
