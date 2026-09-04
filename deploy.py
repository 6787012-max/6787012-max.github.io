# -*- coding: utf-8 -*-
"""פריסת האתר לשני היעדים — הדרך היחידה לדחוף. לא git push ידני!

  origin (6787012-max/gmachim)            → gmachim.mokad.co.il   [עם CNAME]
  short  (6787012-max.github.io, main)    → הכתובת הקצרה          [בלי CNAME]

למה זה קיים: קובץ CNAME ב-repo של אתר-המשתמש היה מחטוף את הדומיין לכל
תת-האתרים (beit-hatalmud, hoze-sign) ושובר כתובות שכבר מאושרות בנטפרי
אצל אנשים אחרים. לכן master נשאר נקי, וה-CNAME מוזרק כ-commit נפרד רק
לצד של gmachim — בלי checkout, דרך plumbing.
"""
import io, os, re, subprocess, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
DOMAIN = "gmachim.mokad.co.il"


def sh(cmd, **kw):
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True,
                       encoding="utf-8", **kw)
    if r.returncode != 0:
        sys.exit("נכשל: %s\n%s" % (" ".join(cmd), (r.stderr or "")[:300]))
    return (r.stdout or "").strip()


def main():
    tok = re.search(r"ghp_[A-Za-z0-9]+",
                    open(r"C:\projects\beit-hatalmud\_CREDENTIALS.md",
                         encoding="utf-8").read()).group(0)
    os.environ["GH_TOKEN"] = tok

    # 1. master נקי → אתר המשתמש
    sh(["git", "push", "-q", "short", "master:main"])
    print("✓ short  (6787012-max.github.io) — בלי CNAME")

    # 2. master + CNAME → gmachim, בלי לגעת ב-working tree
    blob = sh(["git", "hash-object", "-w", "--stdin"], input=DOMAIN + "\n")
    sh(["git", "read-tree", "master"])
    sh(["git", "update-index", "--add", "--cacheinfo",
        "100644,%s,CNAME" % blob])
    tree = sh(["git", "write-tree"])
    commit = sh(["git", "commit-tree", tree, "-p", "master",
                 "-m", "deploy: master + CNAME"],
                env={**os.environ, "GIT_AUTHOR_NAME": "Claude",
                     "GIT_AUTHOR_EMAIL": "noreply@anthropic.com",
                     "GIT_COMMITTER_NAME": "Claude",
                     "GIT_COMMITTER_EMAIL": "noreply@anthropic.com"})
    sh(["git", "push", "-qf", "origin", commit + ":refs/heads/master"])
    sh(["git", "read-tree", "master"])          # להחזיר את האינדקס
    print("✓ origin (%s) — עם CNAME" % DOMAIN)


if __name__ == "__main__":
    main()
