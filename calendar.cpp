// Usage: ./calendar [-m] [-n] [-e file] [month year]
//   -m: week starts Monday, -n: no color, -e: events file (default events.txt)
// Events file lines: "YYYY-MM-DD description"; marked with + in the grid and listed below.
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>
#include <unistd.h>

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
    int m = t->tm_mon + 1, y = t->tm_year + 1900, start = 0;
    bool color = isatty(1);
    int pos[2], np = 0;
    const char* evfile = "events.txt";
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "-m")) start = 1;
        else if (!strcmp(argv[i], "-n")) color = false;
        else if (!strcmp(argv[i], "-e") && i + 1 < argc) evfile = argv[++i];
        else if (np < 2) pos[np++] = atoi(argv[i]);
    }
    if (np == 2) { m = pos[0]; y = pos[1]; }
    if (np == 1 || m < 1 || m > 12 || y < 1) {
        fprintf(stderr, "usage: %s [-m] [-n] [-e file] [month 1-12 year]\n", argv[0]);
        return 1;
    }

    // ponytail: events re-parsed per month, fine for a hand-edited file
    bool ev[32] = {};
    std::vector<std::string> lines;
    std::ifstream in(evfile);
    for (std::string l; std::getline(in, l);) {
        int ey, em, ed, n = 0;
        if (sscanf(l.c_str(), "%d-%d-%d %n", &ey, &em, &ed, &n) >= 3 && ey == y && em == m && ed >= 1 && ed <= dim(y, m)) {
            ev[ed] = true;
            lines.push_back(l);
        }
    }

    static const char* names[] = {"January", "February", "March", "April", "May", "June", "July",
                                  "August", "September", "October", "November", "December"};
    static const char* days[] = {"Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"};
    printf("\n  %s%s %d%s\n", color ? "\033[1;36m" : "", names[m - 1], y, color ? "\033[0m" : "");
    for (int i = 0; i < 7; i++) printf("%s%s%s", color ? "\033[33m" : "", days[(i + start) % 7], color ? "\033[0m " : " ");
    printf("\n");
    for (int i = 0; i < (dow(y, m, 1) - start + 7) % 7; i++) printf("   ");
    for (int d = 1; d <= dim(y, m); d++) {
        int w = dow(y, m, d);
        bool today = d == t->tm_mday && m == t->tm_mon + 1 && y == t->tm_year + 1900;
        char mk = ev[d] ? '+' : ' ';
        if (!color) printf(today ? "%2d*" : "%2d%c", d, mk);  // * marks today (wins over +)
        else if (today) printf("\033[7m%2d\033[0m%c", d, mk);  // reverse video
        else if (w == 0 || w == 6) printf("\033[31m%2d\033[0m%c", d, mk);  // weekends red
        else printf("%2d%c", d, mk);
        if ((w - start + 7) % 7 == 6) printf("\n");
    }
    printf("\n");
    for (auto& l : lines) printf("%s\n", l.c_str());
}
