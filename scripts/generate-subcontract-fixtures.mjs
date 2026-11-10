// Generates the two synthetic Subcontract-mode test PDFs in /test-fixtures,
// plus a ground-truth file for each that scripts/test-subcontract-extraction.mjs
// checks the extraction against:
//
//   node scripts/generate-subcontract-fixtures.mjs
//
// Both contracts are entirely fictional — every name is marked FICTIONAL,
// every ABN is an obviously fake 00 000 000 00x, every address is in the
// non-existent "Faketown QLD", and every email is on a reserved .example
// domain.
//
// - simple-fair-subcontract: plain, balanced terms, everything stated in the
//   clause where you'd look for it.
// - tricky-subcontract: a 3-day variation time bar, 30% retention held to
//   the end of a 12-month defects period, payment "45 days after the end of
//   the month", the real numbers kept in a Schedule on the last page and
//   referenced from the general conditions, a decoy payment period from the
//   head contract, and two terms (a retention cap, a suspension right) the
//   contract doesn't state at all — they must come back "Not found", not
//   filled in from the BIF Act.
//
// Each page is laid out explicitly (no automatic overflow), so the page
// numbers in the ground truth are exact.

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");

const HEAD = "Placeholder Builders Pty Ltd (FICTIONAL)";
const SUB = "Testcase Plumbing Pty Ltd (FICTIONAL)";

// expected: page (or list of acceptable pages) + phrases the quote must
// contain; `null` means the contract doesn't state it and it must be "Not found".
const SIMPLE = {
  name: "simple-fair-subcontract",
  title: "PLUMBING SUBCONTRACT — FICTIONAL TEST DOCUMENT",
  pages: [
    [
      ["h", "Agreement details"],
      ["p", "This document is a fictional sample created for software testing. It is not a real agreement and none of the parties exist."],
      ["p", `Head Contractor: ${HEAD}, ABN 00 000 000 001.`],
      ["p", `Subcontractor: ${SUB}, ABN 00 000 000 002.`],
      ["p", "Site: 1 Example Street, Faketown QLD 4999."],
      ["p", "Contract Sum: $250,000.00 (excluding GST)."],
      ["h", "1. Definitions"],
      ["p", "1.1 In this Subcontract, \"Business Day\" means a day that is not a Saturday, Sunday or public holiday in Brisbane."],
      ["p", "1.2 \"Practical Completion\" has the meaning given in clause 8.2."],
    ],
    [
      ["h", "5. Progress claims"],
      ["p", "5.1 The Subcontractor may submit a progress claim on the 25th day of each month."],
      ["p", "5.2 Progress claims must be sent to the Head Contractor's Contract Administrator."],
      ["p", "5.3 Each progress claim must be submitted by email to claims@placeholder-builders.example as a PDF tax invoice."],
      ["p", "5.4 Each progress claim must be accompanied by an itemised breakdown of the work completed and a completed subcontractor's statement."],
      ["h", "6. Payment"],
      ["p", "6.1 The Head Contractor must pay the amount claimed, or any lesser amount it assesses and explains in writing, within 10 Business Days after receiving the progress claim."],
    ],
    [
      ["h", "7. Retention"],
      ["p", "7.1 The Head Contractor may retain 5% of each progress payment as retention."],
      ["p", "7.2 The total amount retained must not exceed 5% of the Contract Sum."],
      ["p", "7.3 Half of the retention will be released at Practical Completion, and the balance will be released at the end of the Defects Liability Period."],
      ["h", "8. Defects liability"],
      ["p", "8.1 The Defects Liability Period is 12 months from the date of Practical Completion."],
      ["p", "8.2 Practical Completion occurs when the Subcontract Works are complete except for minor defects."],
      ["h", "9. Variations, delays and notices"],
      ["p", "9.1 If the Subcontractor considers that a direction is a variation, it must give written notice within 10 Business Days of receiving the direction."],
      ["p", "9.2 The Subcontractor must give written notice of a claim for an extension of time within 10 Business Days after becoming aware of the delay."],
      ["p", "9.3 A claim for delay costs must be notified in writing within 15 Business Days after the delay ends."],
      ["p", "9.4 The Subcontractor must notify the Head Contractor of any latent condition within 5 Business Days after discovering it."],
    ],
    [
      ["h", "10. Insurance"],
      ["p", "10.1 The Subcontractor must hold public liability insurance of not less than $20,000,000 per occurrence."],
      ["p", "10.2 The Subcontractor must hold workers' compensation insurance covering all of its workers."],
      ["h", "11. Licences"],
      ["p", "11.1 The Subcontractor must hold and maintain a current QBCC licence in the class of plumbing and drainage for the duration of the Subcontract Works."],
      ["h", "12. Termination and suspension"],
      ["p", "12.1 Either party may terminate this Subcontract if the other party commits a substantial breach and does not remedy it within 10 Business Days after receiving a written notice to show cause."],
      ["p", "12.2 The Subcontractor may suspend the Subcontract Works if an amount due is not paid by its due date, by giving 5 Business Days' written notice of its intention to suspend."],
      ["h", "13. Disputes"],
      ["p", "13.1 A party may give a notice of dispute, after which senior representatives of each party must meet within 10 Business Days to try to resolve it, and if it is not resolved either party may commence proceedings in the courts of Queensland."],
    ],
  ],
  expected: {
    "parties.headContractorName": { pages: [1], phrases: ["Placeholder Builders"] },
    "parties.headContractorABN": { pages: [1], phrases: ["00 000 000 001"] },
    "parties.subcontractorName": { pages: [1], phrases: ["Testcase Plumbing"] },
    "parties.siteAddress": { pages: [1], phrases: ["1 Example Street"] },
    "parties.contractSum": { pages: [1], phrases: ["$250,000.00"] },
    "progressClaims.claimDayOrReferenceDates": { pages: [2], phrases: ["25th day of each month"] },
    "progressClaims.claimRecipient": { pages: [2], phrases: ["Contract Administrator"] },
    "progressClaims.claimMethod": { pages: [2], phrases: ["by email"] },
    "progressClaims.requiredSupportingDocs": { pages: [2], phrases: ["itemised breakdown"] },
    "paymentTerms.paymentPeriodAsWritten": { pages: [2], phrases: ["10 Business Days after receiving the progress claim"] },
    "paymentTerms.businessOrCalendarDays": { pages: [1, 2], phrases: ["Business Day"] },
    "retention.retentionPercent": { pages: [3], phrases: ["5% of each progress payment"] },
    "retention.retentionCap": { pages: [3], phrases: ["must not exceed 5% of the Contract Sum"] },
    "retention.retentionReleaseTriggers": { pages: [3], phrases: ["released at Practical Completion"] },
    "defectsLiability.defectsLiabilityPeriod": { pages: [3], phrases: ["12 months from the date of Practical Completion"] },
    "timeBars.variationNoticeDeadline": { pages: [3], phrases: ["within 10 Business Days of receiving the direction"] },
    "timeBars.extensionOfTimeNoticeDeadline": { pages: [3], phrases: ["extension of time within 10 Business Days"] },
    "timeBars.delayClaimNoticeDeadline": { pages: [3], phrases: ["15 Business Days after the delay ends"] },
    "timeBars.otherNoticeDeadlines": { list: [{ pages: [3], phrases: ["latent condition within 5 Business Days"] }] },
    "insuranceAndLicences.requiredInsurances": {
      list: [
        { pages: [4], phrases: ["public liability"], amount: "$20,000,000" },
        { pages: [4], phrases: ["workers' compensation"] },
      ],
    },
    "insuranceAndLicences.licenceRequirements": { pages: [4], phrases: ["QBCC licence"] },
    "termination.terminationRights": { pages: [4], phrases: ["substantial breach"] },
    "termination.suspensionRights": { pages: [4], phrases: ["may suspend the Subcontract Works"] },
    "disputes.disputeResolutionClause": { pages: [4], phrases: ["notice of dispute"] },
  },
};

const T_HEAD = "Hypothetical Constructions Pty Ltd (FICTIONAL)";
const T_SUB = "Dummy Steel Fixing Pty Ltd (FICTIONAL)";

const TRICKY = {
  name: "tricky-subcontract",
  title: "SUBCONTRACT — STRUCTURAL STEEL — FICTIONAL TEST DOCUMENT",
  pages: [
    [
      ["h", "Parties"],
      ["p", "This document is a fictional sample created for software testing. It is not a real agreement and none of the parties exist."],
      ["p", `This Subcontract is made between ${T_HEAD}, ABN 00 000 000 003 (the "Head Contractor"), and ${T_SUB}, ABN 00 000 000 004 (the "Subcontractor").`],
      ["h", "Recitals"],
      ["p", "A. The Head Contractor has entered into a contract with the Principal (the \"Head Contract\") for the construction of a warehouse at Lot 7, 99 Pretend Road, Faketown QLD 4999 (the \"Site\")."],
      ["p", "B. Under the Head Contract, the Principal pays the Head Contractor within 25 business days of a valid claim. That payment period does not apply to this Subcontract."],
      ["p", "C. The Head Contractor wishes to engage the Subcontractor to supply and install structural steel on the terms of this Subcontract."],
      ["h", "1. Interpretation"],
      ["p", "1.1 Where a clause refers to an Item, it means the corresponding Item in the Schedule, which forms part of this Subcontract."],
      ["p", "1.2 If there is any inconsistency between these General Conditions and the Schedule, the Schedule prevails."],
    ],
    [
      ["h", "2. Payment claims"],
      ["p", "2.1 The Subcontractor may make a payment claim on the date stated in Item 5, and not otherwise."],
      ["p", "2.2 Payment claims must be addressed to the Head Contractor's Project Manager."],
      ["p", "2.3 Payment claims must be uploaded through the Head Contractor's online portal at portal.hypothetical-constructions.example. Payment claims sent by email or post will not be accepted."],
      ["p", "2.4 Each payment claim must include a statutory declaration that all workers and suppliers have been paid, a subcontractor's statement, and copies of payroll records for the claim period."],
      ["h", "3. Payment"],
      ["p", "3.1 Subject to clause 2, the Head Contractor will pay the Subcontractor within the period stated in Item 7."],
      ["p", "3.2 Payment of any amount is not evidence that the work has been performed satisfactorily."],
    ],
    [
      ["h", "4. Retention"],
      ["p", "4.1 The Head Contractor may withhold from each progress payment retention at the rate stated in Item 8."],
      ["p", "4.2 Retention will be held until the expiry of the Defects Liability Period and released within 28 days after the Subcontractor has rectified all notified defects."],
      ["h", "5. Defects"],
      ["p", "5.1 The Subcontractor must rectify any defect notified during the Defects Liability Period stated in Item 10."],
      ["h", "6. Variations"],
      ["p", "6.1 The Head Contractor may direct a variation at any time. If the Subcontractor considers that any direction constitutes a variation, the Subcontractor must give the Head Contractor written notice to that effect within 3 days of the direction, failing which the Subcontractor waives any entitlement to payment for that variation."],
      ["h", "7. Extensions of time and delay"],
      ["p", "7.1 The Subcontractor must give written notice of any claim for an extension of time within 2 days after the delay commences, failing which the Subcontractor is not entitled to an extension of time."],
      ["p", "7.2 Any claim for delay or disruption costs must be submitted within 5 days after the end of the delay, failing which the claim is barred."],
      ["p", "7.3 Any other claim arising under or in connection with this Subcontract must be notified in writing within 7 days after the event giving rise to it, failing which it is barred."],
    ],
    [
      ["h", "8. Insurance and licences"],
      ["p", "8.1 The Subcontractor must hold public liability insurance of not less than $10,000,000 for any one occurrence."],
      ["p", "8.2 The Subcontractor must effect contract works insurance for the full value of the Subcontract Works."],
      ["p", "8.3 The Subcontractor must hold a current QBCC licence in the structural metal fabrication and erection class."],
      ["h", "9. Termination"],
      ["p", "9.1 The Head Contractor may terminate this Subcontract at any time for its convenience by giving 5 days' written notice to the Subcontractor."],
      ["p", "9.2 The Head Contractor may terminate this Subcontract immediately if the Subcontractor fails to comply with any direction."],
      ["h", "10. Disputes"],
      ["p", "10.1 Any dispute arising under this Subcontract must be referred to arbitration in Brisbane under the rules of the Resolution Institute."],
    ],
    [
      ["h", "Schedule"],
      ["p", "Item 1 — Head Contractor: as stated in the Parties clause."],
      ["p", "Item 2 — Subcontractor: as stated in the Parties clause."],
      ["p", "Item 3 — Subcontract Works: supply and installation of structural steel for the warehouse."],
      ["p", "Item 4 — Subcontract Sum: $1,480,000.00 (excluding GST)."],
      ["p", "Item 5 — Date for payment claims: the 20th day of each month."],
      ["p", "Item 6 — Date for Practical Completion: as directed by the Head Contractor."],
      ["p", "Item 7 — Time for payment: 45 days after the end of the month in which the payment claim is received."],
      ["p", "Item 8 — Retention rate: 30% of each progress payment."],
      ["p", "Item 9 — Liquidated damages: $5,000 per day."],
      ["p", "Item 10 — Defects Liability Period: 12 months from Practical Completion of the Head Contract works."],
    ],
  ],
  expected: {
    "parties.headContractorName": { pages: [1], phrases: ["Hypothetical Constructions"] },
    "parties.headContractorABN": { pages: [1], phrases: ["00 000 000 003"] },
    "parties.subcontractorName": { pages: [1], phrases: ["Dummy Steel Fixing"] },
    "parties.siteAddress": { pages: [1], phrases: ["99 Pretend Road"] },
    "parties.contractSum": { pages: [5], phrases: ["$1,480,000.00"] },
    "progressClaims.claimDayOrReferenceDates": { pages: [5], phrases: ["20th day of each month"] },
    "progressClaims.claimRecipient": { pages: [2], phrases: ["Project Manager"] },
    "progressClaims.claimMethod": { pages: [2], phrases: ["online portal"] },
    "progressClaims.requiredSupportingDocs": { pages: [2], phrases: ["statutory declaration"] },
    "paymentTerms.paymentPeriodAsWritten": { pages: [5], phrases: ["45 days after the end of the month"], forbid: ["25 business days"] },
    "paymentTerms.businessOrCalendarDays": { pages: [5], phrases: ["45 days"] },
    "retention.retentionPercent": { pages: [5], phrases: ["30% of each progress payment"] },
    "retention.retentionCap": null,
    "retention.retentionReleaseTriggers": { pages: [3], phrases: ["expiry of the Defects Liability Period"] },
    "defectsLiability.defectsLiabilityPeriod": { pages: [5], phrases: ["12 months from Practical Completion"] },
    "timeBars.variationNoticeDeadline": { pages: [3], phrases: ["within 3 days of the direction"] },
    "timeBars.extensionOfTimeNoticeDeadline": { pages: [3], phrases: ["within 2 days after the delay commences"] },
    "timeBars.delayClaimNoticeDeadline": { pages: [3], phrases: ["within 5 days after the end of the delay"] },
    "timeBars.otherNoticeDeadlines": { list: [{ pages: [3], phrases: ["within 7 days after the event"] }] },
    "insuranceAndLicences.requiredInsurances": {
      list: [
        { pages: [4], phrases: ["public liability"], amount: "$10,000,000" },
        { pages: [4], phrases: ["contract works insurance"] },
      ],
    },
    "insuranceAndLicences.licenceRequirements": { pages: [4], phrases: ["QBCC licence"] },
    "termination.terminationRights": { pages: [4], phrases: ["for its convenience"] },
    "termination.suspensionRights": null,
    "disputes.disputeResolutionClause": { pages: [4], phrases: ["arbitration in Brisbane"] },
  },
};

function render(fixture) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 64, right: 64 }, autoFirstPage: true });
    const out = createWriteStream(path.join(OUT_DIR, `${fixture.name}.pdf`));
    out.on("finish", resolve);
    out.on("error", reject);
    doc.pipe(out);
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    fixture.pages.forEach((page, i) => {
      if (i > 0) doc.addPage();
      if (i === 0) doc.font("Helvetica-Bold").fontSize(14).text(fixture.title).moveDown(0.8);
      for (const [kind, text] of page) {
        if (kind === "h") doc.font("Helvetica-Bold").fontSize(11).text(text).moveDown(0.3);
        else doc.font("Helvetica").fontSize(10).text(text, { lineGap: 2 }).moveDown(0.5);
        // Content must never spill onto an automatic extra page, or the
        // ground-truth page numbers would be wrong.
        if (doc.y > bottomLimit) throw new Error(`${fixture.name}: page ${i + 1} overflowed`);
      }
      doc.font("Helvetica").fontSize(8).text(`FICTIONAL TEST DOCUMENT — page ${i + 1} of ${fixture.pages.length}`, 64, doc.page.height - 50, { lineBreak: false });
    });
    doc.end();
  });
}

await mkdir(OUT_DIR, { recursive: true });
for (const fixture of [SIMPLE, TRICKY]) {
  await render(fixture);
  await writeFile(
    path.join(OUT_DIR, `${fixture.name}.expected.json`),
    JSON.stringify({ file: `${fixture.name}.pdf`, pageCount: fixture.pages.length, expected: fixture.expected }, null, 2) + "\n"
  );
  console.log(`wrote test-fixtures/${fixture.name}.pdf (+ .expected.json)`);
}
