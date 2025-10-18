export interface Student {
  id: string;
  name: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "NOT_SET";
}

export interface Group {
  id: string;
  number: string;
  name: string | null;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    middleInitial: string | null;
    image: string | null;
  }[];
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    middleInitial: string | null;
    image: string | null;
  } | null;
}
