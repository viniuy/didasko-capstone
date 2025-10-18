import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

interface FacultyCardProps {
  name: string;
  image: string;
  department: string;
  onDepartmentClick: (department: string) => void;
}

const FacultyCard: React.FC<FacultyCardProps> = ({
  name,
  image,
  department,
  onDepartmentClick,
}) => {
  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onDepartmentClick(department)}
    >
      <CardContent className="p-4">
        <div className="flex items-center">
          <Image
            src={image}
            alt={name}
            width={48}
            height={48}
            className="rounded-full mr-4"
          />
          <div>
            <h3 className="font-medium text-[#124A69]">{name}</h3>
            <p className="text-sm text-gray-500">{department}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FacultyCard;
