# AGENTS.md

This file provides guidance and necessary practices for Codex, Cursor, and Claude to follow when working with code in this repository.

## Project Overview

This is a Chrome extension that is meant to further automate the process of grading on the Gradescope platform. As Gradescope does not have a native API or endpoint, this will be done via HTML text extraction, background worker tabs, etc. The three primary features this extension will cover are:

1. Be able to move a submission from one group to another. Gradescope has a feature where you can group identical submissions together and then grade the entire group as a whole instead of having to grade the individual submissions. Sometimes a submission ends up in the wrong group and we need to move it. Gradescope does not allow you to move an item from one group directly to another. Instead you have to take the item you want to move and remove it from the group, which will place it into the ungrouped submissions. You won't know where it is placed in the ungrouped submissions and if there are a lot of them it can be very hard to find it. 

2. Code based AI/OCR grouping for text answers. Gradescope has a feature where it can use an "AI" to group together answers for you. When you have a fill in the blank answer, you select text based grouping and it gives you the option to select whether the text will be just normal text (words) or a math expression. Of course we often write code in my classes and the AI struggles to correctly do the grouping for code. I think it struggles because of certain symbols that commonly appear in our code ([], {}, %, *, _ , etc.) and that our variable names are longer than a math symbol.

3. AI assisted grading. I'd like the AI to automate grading given a reference rubric to work off of.

## Development SOPs:

**Never push directly to the main branch.**

When adding a feature or part of a feature on top of the existing Chrome extension:

1. Create a different branch.
2. Add your features on top of that branch. Try to only add code when possible; AI has a bad history of modifying and deleting code, and in the process deleting important parts of a feature someone else worked on. Of course this is not a hard requirement.
3. When your feature is complete, test your additions by running the extension locally. 
4. When you're comfortable with your feature, issue a PR from your branch against the main branch, and **tag T-S123 for review. I will take care of merging it to staging.** If you don't do this, someone else might have to git pull and potentially restart building their feature if your changes are large enough. To be fair, if anything is merged without going through the PR process, I will revert the changes. 
