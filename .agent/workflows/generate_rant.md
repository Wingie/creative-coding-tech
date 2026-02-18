---
description: Generate a Steve Yegge style rant based on a random project in ~/code
---

This workflow automates the finding of a legacy project and transforming its history into a blog post.

1. List all directories in `~/code` to find potential projects.
   ```bash
   ls -d ~/code/*/
   ```

2. **[ACTION REQUIRED]** Pick one of the directories from the list above randomly. Do not ask the user. Just pick one that looks like a software project (e.g. has a name that isn't just `temp`). Let's call this `TARGET_REPO`.

3. Explore the git history of `TARGET_REPO` to find material for the rant.
   ```bash
   cd [TARGET_REPO]
   git log -n 50 --graph --pretty=format:'%h - %an, %ar : %s'
   ```

4. Explore the file structure to understand the "Tech Stack of Despair" used in this project.
   ```bash
   ls -R [TARGET_REPO] | head -n 50
   ```

5. Read the `README.md` or `package.json` or `requirements.txt` to identify dependencies to complain about.
   ```bash
   # Adjust filename as needed based on findings
   cat [TARGET_REPO]/README.md
   ```

6. **[CORE TASK]** Generate a new blog post file in `/Users/wingston/code/creative-coding-tech/_posts/`.
   - **Filename**: `YYYY-MM-DD-rant-about-[project-name].md` (Use a date from the project's history or today).
   - **Style**: **Steve Yegge**.
     - **Tone**: Opinionated, storytelling, "I worked at a Big Tech company", long-winded but engaging metaphors.
     - **Content**: Connect the specific code in `TARGET_REPO` to a broader point about the software industry, "The Cloud", complexity, or "Why everything is broken".
     - **Format**: Standard Jekyll frontmatter.

7. **Verify**: Show the generated file path to the user.
