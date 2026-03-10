import {
  BookBookmark,
  House2,
  BarChart,
  AreaChart,
  LineChart,
  PieChart,
  RadarChart,
  SquareCode,
} from "@/assets/svgs";
import { SidebarOptionsProps } from "@/types/docs/sidebar-types";

export const SIDEBAR_OPTIONS: SidebarOptionsProps = {
  gettingStarted: [
    {
      title: "Getting Started",
      url: "/docs",
      items: [
        {
          title: "Introduction",
          url: "/docs",
          icon: <House2 />,
        },
        {
          title: "Prerequisites",
          url: "/docs/prerequisites",
          icon: <BookBookmark />,
        },
        {
          title: "Chart Builder",
          url: "/docs/chart-builder",
          icon: <SquareCode />,
        },
      ],
    },
  ],
  components: [
    {
      title: "Bar Charts",
      url: "#",
      items: [
        {
          title: "Bar Chart",
          url: "/docs/bar-charts",
          icon: <BarChart />,
        },
        {
          title: "Animated Bar Chart",
          url: "/docs/animated-bar-charts",
          icon: <BarChart />,
        },
      ],
    },
    {
      title: "Area Charts",
      url: "#",
      items: [
        {
          title: "Area Chart",
          url: "/docs/area-charts",
          icon: <AreaChart />,
        },
        {
          title: "Animated Area Chart",
          url: "/docs/animated-area-charts",
          icon: <AreaChart />,
        },
      ],
    },
    {
      title: "Charts",
      url: "#",
      items: [
        {
          title: "Line Chart",
          url: "/docs/line-charts",
          icon: <LineChart />,
        },
        {
          title: "Pie Chart",
          url: "/docs/pie-charts",
          icon: <PieChart />,
        },
        {
          title: "Radar Chart",
          url: "/docs/radar-charts",
          icon: <RadarChart />,
        },
      ],
    },
  ],
};
