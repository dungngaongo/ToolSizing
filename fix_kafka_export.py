#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import shutil

file_path = r'D:\Source_code\sizing\backend1\src\main\java\com\example\sizing\service\ExportService.java'

# Backup file
shutil.copy2(file_path, file_path + '.bak')

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the position to insert (after compressionEvidence line)
search_text = '''addInlineImages(doc, throughputMethod.path("compressionEvidence"), buildCaption(heading + " - S\\u1edf c\\u1ee9 compression Kafka", null));

                    String resultHTML = txt(throughputMethod, "resultHTML");'''

replace_text = '''addInlineImages(doc, throughputMethod.path("compressionEvidence"), buildCaption(heading + " - S\\u1edf c\\u1ee9 compression Kafka", null));

                    // Helper tool evidence
                    addInlineImages(doc, throughputMethod.path("helperMsgEvidence"), buildCaption(heading + " - Sở cứ Message count", null));
                    addInlineImages(doc, throughputMethod.path("helperSizeEvidence"), buildCaption(heading + " - Sở cứ Message size", null));

                    String resultHTML = txt(throughputMethod, "resultHTML");'''

if search_text in content:
    content = content.replace(search_text, replace_text)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Successfully added helper tool evidence export code!")
    print("Added 2 lines to export helperMsgEvidence and helperSizeEvidence")
else:
    print("❌ Could not find the target text to replace!")
    print("Please check if ExportService.java has been modified")