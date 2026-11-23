// ./calendar [-m] [-n] [-w] [-y] [-e file] [[month] year]
//   -m Monday start, -n no color, -w ISO week numbers, -y whole year, -e events file (events.txt)
// ./calendar [-e file] add YYYY-MM-DD text...      appends an event
// Event lines:  2026-11-26 Thanksgiving | *-12-25 Christmas (yearly) | weekly:Mon Standup
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <string>
#include <vector>
#include <unistd.h>

int start, wk, color;
const char* evfile = "events.txt";
tm now;

tm date(int y, int m, int d) {  // mktime normalizes overflow (day 0 = last of prev month) and fills tm_wday
    tm t = {};
    t.tm_year = y - 1900, t.tm_mon = m - 1, t.tm_mday = d, t.tm_hour = 12;
    mktime(&t);
    return t;
}
int dim(int y, int m) { return date(y, m + 1, 0).tm_mday; }

void show(int y, int m) {
    int n = dim(y, m);
    std::vector<std::string> lines, notes;
    for (std::ifstream in(evfile); in;) { std::string l; if (std::getline(in, l)) lines.push_back(l); }
    bool ev[32] = {};
    for (int d = 1; d <= n; d++) {
        tm t = date(y, m, d);
        char k[3][16];
        strftime(k[0], 16, "%Y-%m-%d", &t), strftime(k[1], 16, "*-%m-%d", &t), strftime(k[2], 16, "weekly:%a", &t);
        for (auto& l : lines)
            for (auto& key : k) {
                size_t len = strlen(key);
                if (!l.compare(0, len, key) && (l.size() == len || l[len] == ' ')) {
                    ev[d] = true;
                    notes.push_back(std::string(k[0]) + l.substr(len));
                }
            }
    }

    static const char* dn[] = {"Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"};
    char title[32];
    tm f = date(y, m, 1);
    strftime(title, 32, "%B %Y", &f);
    printf("\n  %s%s%s\n%s", color ? "\033[1;36m" : "", title, color ? "\033[0m" : "", wk ? "   " : "");
    for (int i = 0; i < 7; i++) printf("%s ", dn[(i + start) % 7]);
    printf("\n");

    int col = (f.tm_wday - start + 7) % 7;
    for (int i = 1 - col; i <= n; i++) {
        int c = (i - 1 + col) % 7, w = (c + start) % 7;
        if (c == 0 && wk) {  // ISO week of this row's Monday
            tm mon = date(y, m, i + 1 - start);
            char b[4];
            strftime(b, 4, "%V", &mon);
            printf("%2s ", b);
        }
        if (i < 1) { printf("   "); continue; }
        bool today = y == now.tm_year + 1900 && m == now.tm_mon + 1 && i == now.tm_mday;
        const char* a = !color ? "" : today ? "\033[7m" : (w == 0 || w == 6) ? "\033[31m" : "";
        char mk = ev[i] ? (!color && today ? '#' : '+') : !color && today ? '*' : ' ';  // no color: * today, + event, # both
        printf("%s%2d%s%c%s", a, i, *a ? "\033[0m" : "", mk, c == 6 ? "\n" : "");
    }
    if ((n - 1 + col) % 7 != 6) printf("\n");
    for (auto& s : notes) printf("%s\n", s.c_str());
}

int main(int argc, char** argv) {
    assert(dim(2024, 2) == 29 && date(2000, 1, 1).tm_wday == 6);  // self-check
    time_t t = time(nullptr);
    now = *localtime(&t);
    color = isatty(1);
    int m = now.tm_mon + 1, y = now.tm_year + 1900, pos[2], np = 0;
    bool year = false;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "-m") start = 1;
        else if (a == "-n") color = 0;
        else if (a == "-w") wk = 1;
        else if (a == "-y") year = true;
        else if (a == "-e" && i + 1 < argc) evfile = argv[++i];
        else if (a == "add" && np == 0) {
            int ey, em, ed;
            if (i + 2 >= argc || sscanf(argv[i + 1], "%d-%d-%d", &ey, &em, &ed) != 3 || date(ey, em, ed).tm_mon != em - 1) {
                fprintf(stderr, "usage: %s [-e file] add YYYY-MM-DD text...\n", argv[0]);
                return 1;
            }
            FILE* f = fopen(evfile, "a");
            if (!f) return perror(evfile), 1;
            fprintf(f, "%04d-%02d-%02d", ey, em, ed);
            for (int j = i + 2; j < argc; j++) fprintf(f, " %s", argv[j]);
            fprintf(f, "\n");
            return fclose(f), 0;
        } else if (np < 2) pos[np++] = atoi(argv[i]);
    }
    if (year ? np : np == 2) y = pos[np - 1], m = year ? m : pos[0];
    if ((!year && np == 1) || m < 1 || m > 12 || y < 1) return fprintf(stderr, "usage: %s [-m] [-n] [-w] [-y] [-e file] [[month] year]\n", argv[0]), 1;
    if (year) for (m = 1; m <= 12; m++) show(y, m);
    else show(y, m);
}
