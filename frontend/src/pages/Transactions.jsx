import Navbar from '../components/Navbar';
import TransactionForm from '../components/TransactionForm';

function Transactions() {
  return (
    <>
      <Navbar />
      <main className="app-shell">
        <section className="hero-card">
          <h1>Transactions</h1>
          <p className="subtext">Add and review your spending here.</p>
        </section>
        <TransactionForm />
      </main>
    </>
  );
}

export default Transactions;
