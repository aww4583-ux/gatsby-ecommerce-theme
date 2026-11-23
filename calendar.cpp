// Usage: ./calendar [-m] [-n] [-w] [-y] [-e file] [[month] year]
//   -m: week starts Monday, -n: no color, -w: ISO week numbers, -y: whole-year view,
//   -e: events file (default events.txt)
//   ./calendar [-e file] add YYYY-MM-DD text...   appends an event
// Events file lines (marked + in the grid, listed below a single month):
//   2026-11-26 Thanksgiving     one-off
//   *-12-25 Christmas           every year
//   weekly:Mon Standup          every Monday
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <cstring>
#include <fstream>
#include <algorithm>
#include <string>
#include <vector>
#include <unistd.h>

typedef std::vector<std::string> Rows;
typedef std::vector<std::pair<int, std::string>> Events;  // (day, text)

static const char* days[] = {"Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"};
static const char* names[] = {"January", "February", "March", "April", "May", "June", "July",
                              "August", "September", "October", "November", "December"};

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

int weeksIn(int y) {  // ISO weeks in year: 52 or 53
    auto p = [](int y) { return (y + y / 4 - y / 100 + y / 400) % 7; };
    return p(y) == 4 || p(y - 1) == 3 ? 53 : 52;
}

int isoWeek(int y, int m, int d) {
    int doy = d;
    for (int i = 1; i < m; i++) doy += dim(y, i);
    int w = (doy - ((dow(y, m, d) + 6) % 7 + 1) + 10) / 7;
    return w < 1 ? weeksIn(y - 1) : w > weeksIn(y) ? 1 : w;
}

struct Opt { int start; bool color, wk; };

// Parses the events file for one month: ev[day] marks, list gets (day, text).
void loadEvents(const char* file, int y, int m, bool* ev, Events& list) {
    std::ifstream in(file);
    for (std::string l; std::getline(in, l);) {
        int ey, em, ed, n = 0;
        char wk[4];
        auto text = [&] { return n > 0 && (size_t)n <= l.size() ? l.substr(n) : std::string(); };
        auto hit = [&](int d) { ev[d] = true; list.push_back({d, text()}); };
        if (sscanf(l.c_str(), "weekly:%3s %n", wk, &n) == 1) {
            for (int i = 0; i < 7; i++)
                if (!strncmp(wk, days[i], 2))
                    for (int d = 1; d <= dim(y, m); d++) if (dow(y, m, d) == i) hit(d);
        } else if (sscanf(l.c_str(), "*-%d-%d %n", &em, &ed, &n) >= 2) {
            if (em == m && ed >= 1 && ed <= dim(y, m)) hit(ed);
        } else if (sscanf(l.c_str(), "%d-%d-%d %n", &ey, &em, &ed, &n) >= 3) {
            if (ey == y && em == m && ed >= 1 && ed <= dim(y, m)) hit(ed);
        }
    }
    std::stable_sort(list.begin(), list.end(), [](const std::pair<int, std::string>& a, const std::pair<int, std::string>& b) { return a.first < b.first; });
}

// One month as rows of constant visible width (ANSI codes are zero-width), so months tile side by side.
Rows month(int y, int m, const Opt& o, const bool* ev, const tm* t) {
    const int W = o.wk ? 24 : 21;
    const char *c1 = o.color ? "\033[1;36m" : "", *c2 = o.color ? "\033[33m" : "", *c0 = o.color ? "\033[0m" : "";
    Rows r;
    std::string title = std::string(names[m - 1]) + " " + std::to_string(y);
    r.push_back(std::string((W - title.size()) / 2, ' ') + c1 + title + c0 + std::string(W - (W - title.size()) / 2 - title.size(), ' '));
    std::string hd = o.wk ? "   " : "";
    for (int i = 0; i < 7; i++) hd += std::string(c2) + days[(i + o.start) % 7] + c0 + " ";
    r.push_back(hd);

    int N = dim(y, m);
    for (int d = 1; d <= N;) {
        int col = (dow(y, m, d) - o.start + 7) % 7;
        std::string row;
        if (o.wk) {  // ponytail: label = ISO week of the row's Monday (or its first day if Monday is outside the month)
            int mon = d + ((1 - o.start + 7) % 7 - col), wd = mon >= d && mon <= N ? mon : d;
            char b[8];
            snprintf(b, sizeof b, o.color ? "\033[2m%2d\033[0m " : "%2d ", isoWeek(y, m, wd));
            row = b;
        }
        row += std::string(col * 3, ' ');
        for (; col < 7 && d <= N; col++, d++) {
            int w = dow(y, m, d);
            bool today = d == t->tm_mday && m == t->tm_mon + 1 && y == t->tm_year + 1900;
            char mk = ev[d] ? '+' : ' ', b[48];
            if (!o.color) snprintf(b, sizeof b, today ? "%2d*" : "%2d%c", d, mk);  // * marks today (wins over +)
            else if (today) snprintf(b, sizeof b, "\033[7m%2d\033[0m%c", d, mk);  // reverse video
            else if (w == 0 || w == 6) snprintf(b, sizeof b, "\033[31m%2d\033[0m%c", d, mk);  // weekends red
            else snprintf(b, sizeof b, "%2d%c", d, mk);
            row += b;
        }
        row += std::string((7 - col) * 3, ' ');
        r.push_back(row);
    }
    return r;
}

int main(int argc, char** argv) {
    // self-check
    assert(dow(2000, 1, 1) == 6 && dim(2024, 2) == 29 && dim(1900, 2) == 28);
    assert(isoWeek(2021, 1, 1) == 53 && isoWeek(2024, 12, 30) == 1 && isoWeek(2026, 1, 1) == 1 &&
           isoWeek(2026, 11, 23) == 48);

    time_t now = time(nullptr);
    tm* t = localtime(&now);
    int m = t->tm_mon + 1, y = t->tm_year + 1900;
    Opt o = {0, (bool)isatty(1), false};
    bool yearView = false;
    int pos[2], np = 0, add = 0;
    const char* evfile = "events.txt";
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "-m")) o.start = 1;
        else if (!strcmp(argv[i], "-n")) o.color = false;
        else if (!strcmp(argv[i], "-w")) o.wk = true;
        else if (!strcmp(argv[i], "-y")) yearView = true;
        else if (!strcmp(argv[i], "-e") && i + 1 < argc) evfile = argv[++i];
        else if (!strcmp(argv[i], "add") && np == 0) { add = i; break; }
        else if (np < 2) pos[np++] = atoi(argv[i]);
    }
    if (add) {  // add YYYY-MM-DD text...
        int ey, em, ed;
        if (add + 2 >= argc || sscanf(argv[add + 1], "%d-%d-%d", &ey, &em, &ed) != 3 || em < 1 || em > 12 ||
            ed < 1 || ed > dim(ey, em)) {
            fprintf(stderr, "usage: %s [-e file] add YYYY-MM-DD text...\n", argv[0]);
            return 1;
        }
        FILE* f = fopen(evfile, "a");
        if (!f) { perror(evfile); return 1; }
        fprintf(f, "%04d-%02d-%02d", ey, em, ed);
        for (int i = add + 2; i < argc; i++) fprintf(f, " %s", argv[i]);
        fprintf(f, "\n");
        fclose(f);
        return 0;
    }
    if (yearView) { if (np) y = pos[np - 1]; }
    else if (np == 2) { m = pos[0]; y = pos[1]; }
    if ((!yearView && (np == 1 || m < 1 || m > 12)) || y < 1) {
        fprintf(stderr, "usage: %s [-m] [-n] [-w] [-y] [-e file] [[month] year]\n", argv[0]);
        return 1;
    }

    if (!yearView) {
        bool ev[32] = {};
        Events list;
        loadEvents(evfile, y, m, ev, list);
        printf("\n");
        for (auto& l : month(y, m, o, ev, t)) printf("%s\n", l.c_str());
        for (auto& e : list) printf("%04d-%02d-%02d %s\n", y, m, e.first, e.second.c_str());
        return 0;
    }

    // ponytail: year view marks events but doesn't list them (use single-month view for the list)
    const int W = o.wk ? 24 : 21;
    printf("\n%*s%d\n", (3 * W + 4 - 4) / 2, "", y);
    for (int q = 0; q < 12; q += 3) {
        Rows cols[3];
        size_t h = 0;
        for (int k = 0; k < 3; k++) {
            bool ev[32] = {};
            Events list;
            loadEvents(evfile, y, q + k + 1, ev, list);
            cols[k] = month(y, q + k + 1, o, ev, t);
            h = std::max(h, cols[k].size());
        }
        for (size_t i = 0; i < h; i++) {
            for (int k = 0; k < 3; k++)
                printf("%s%s", i < cols[k].size() ? cols[k][i].c_str() : std::string(W, ' ').c_str(), k < 2 ? "  " : "");
            printf("\n");
        }
        printf("\n");
    }
}
