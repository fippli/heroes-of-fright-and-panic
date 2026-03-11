import { Link } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";

export const AboutPage = () => {
  return (
    <SplitLayout pageTitle="About">
      <p>
        Heroes of Fright and Panic is a turn-based strategy game where two
        players command rival alliances — Day and Night — on a shared
        battlefield. Build your forces, outmaneuver your opponent, and claim
        victory.
      </p>

      <Link to="/games" className="back-link">
        Back to menu
      </Link>
    </SplitLayout>
  );
};
