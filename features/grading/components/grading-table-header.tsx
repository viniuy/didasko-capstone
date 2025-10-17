import React from "react";

interface RubricDetail {
  name: string;
  percentage: number;
}

interface GradingTableHeaderProps {
  rubricDetails: RubricDetail[];
  activeReport?: { passingScore: number };
}

const GradingTableHeader: React.FC<GradingTableHeaderProps> = ({
  rubricDetails,
  activeReport,
}) => (
  <thead className="bg-white">
    <tr>
      <th className="sticky left-0 z-10 bg-white border-b font-bold text-[#124A69] text-left px-4 py-3 w-[300px]">
        Students
      </th>
      {rubricDetails.map((rubric, i) => (
        <th
          key={rubric.name + i}
          className={`border-b font-bold text-[#124A69] text-center px-4 py-3 w-[120px] ${
            rubricDetails.length === 4 ? "text-sm" : ""
          }`}
        >
          {rubric.name}
          <div className="text-xs text-gray-500 font-normal">
            ({rubric.percentage}%)
          </div>
        </th>
      ))}
      <th className="border-b font-bold text-[#124A69] text-center px-4 py-3 w-[100px]">
        Total Grade
        <div className="text-xs text-gray-500 font-normal">
          (Passing: {activeReport?.passingScore}%)
        </div>
      </th>
      <th className="border-b font-bold text-[#124A69] text-center px-4 py-3 w-[100px]">
        Remarks
      </th>
    </tr>
  </thead>
);

export default GradingTableHeader;
