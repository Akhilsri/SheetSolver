const ExcelJS = require("exceljs");
const fs = require("fs");

function cellToString(cell) {
  if (!cell || cell.value === null) return "";
  if (typeof cell.value === "object") {
    if (cell.value.text) return cell.value.text;
    if (cell.value.richText)
      return cell.value.richText.map((t) => t.text).join("");
    if (cell.value.result) return cell.value.result.toString();
    return JSON.stringify(cell.value);
  }
  return cell.value.toString();
}

async function extractProblems() {
  const filePath = "DSA by Shradha Ma'am (1).xlsx";
  const outputCSV = "problems_with_difficulty.csv";

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.getWorksheet("DSA in 2.5 Months");

  // === Step 1: Detect color → difficulty mapping from rows 5–7 ===
  const difficultyMap = {};
  for (let rowIdx = 5; rowIdx <= 7; rowIdx++) {
    const cell = sheet.getRow(rowIdx).getCell(1); // Column A
    const label = cellToString(cell);
    if (label && cell.fill && cell.fill.fgColor) {
      const color = cell.fill.fgColor.argb;
      difficultyMap[color] = label;
    }
  }

  console.log("Detected difficulty map:", difficultyMap);

  // === Step 2: Extract problems (row 11 onward) ===
  const problems = [];
  const headerRow = 10;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    const topicCell = row.getCell(1); // Title
    const questionCell = row.getCell(2); // Question

    if (!questionCell.value) return;

    const color =
      topicCell.fill && topicCell.fill.fgColor ? topicCell.fill.fgColor.argb : null;
    const difficulty = color && difficultyMap[color] ? difficultyMap[color] : "Unknown";

    problems.push({
      title: cellToString(topicCell),
      question: cellToString(questionCell),
      url: "",
      difficulty: difficulty,
    });
  });

  // === Step 3: Save to CSV ===
  const csvLines = ["title,question,url,difficulty"];
  problems.forEach((p) => {
    const row = [
      `"${p.title}"`,
      `"${p.question}"`,
      `"${p.url}"`,
      `"${p.difficulty}"`,
    ];
    csvLines.push(row.join(","));
  });

  fs.writeFileSync(outputCSV, csvLines.join("\n"), "utf8");
  console.log(`✅ Extracted ${problems.length} problems and saved to ${outputCSV}`);
}

extractProblems().catch((err) => console.error("Error:", err));
