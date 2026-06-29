import TransactionForm from './components/TransactionForm';
import Home from "./pages/Home";

export default function App() {
  return (
    <>
    <div>
        <Home />
      </div>
      <div className="max-w-md mx-auto p-6 mt-10">
        <h1 className="text-2xl font-bold mb-4">
          Finance Tracker
        </h1>

        <TransactionForm />
      </div>

      
    </>
  );
}