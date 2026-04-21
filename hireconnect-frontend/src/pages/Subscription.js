import React, { useState, useEffect, useMemo } from 'react';
import { subscriptionAPI, profileAPI, analyticsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorMessage';
import './Subscription.css';

const FALLBACK_FEATURES = {
  FREE: ['Browse platform', 'Limited exploration'],
  PROFESSIONAL: ['Post jobs', 'Applicant tracking', 'Email notifications'],
  ENTERPRISE: ['Everything in Professional', 'Priority support', 'Scale hiring'],
};

function formatDt(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  } catch {
    return String(value);
  }
}

export default function Subscription() {
  const { user, updateUser } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const recruiterIdRaw = user?.profileId ?? user?.userId ?? user?.id;
  const recruiterIdParsed =
    recruiterIdRaw == null || recruiterIdRaw === '' ? NaN : Number(recruiterIdRaw);
  const recruiterId = Number.isFinite(recruiterIdParsed) ? recruiterIdParsed : null;

  const displayPlans = useMemo(() => {
    const list = Array.isArray(catalog) && catalog.length ? catalog : [];
    return list.map((p) => ({
      ...p,
      features: FALLBACK_FEATURES[p.code] || [p.summary || ''],
    }));
  }, [catalog]);

  // Load profile so recruiterId matches profile PK (subscription rows use the same id).
  useEffect(() => {
    if (!user?.email || user?.profileId != null) return;
    let cancelled = false;
    const email = user.email;
    profileAPI
      .getProfileByEmail(email)
      .then((res) => {
        if (cancelled || !res?.data) return;
        const found = res.data;
        const pid = found.profileId ?? found.id;
        if (pid == null) return;
        let base = {};
        try {
          const raw = localStorage.getItem('hc_user');
          if (raw) base = JSON.parse(raw);
        } catch {
          /* ignore */
        }
        updateUser({ ...base, ...found, profileId: Number(pid) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.profileId, updateUser]);

  useEffect(() => {
    let cancelled = false;
    subscriptionAPI
      .getPlans()
      .then((r) => {
        if (!cancelled) setCatalog(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (recruiterId == null) return;
    subscriptionAPI
      .getByRecruiter(recruiterId)
      .then((r) => setSubscriptions(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    subscriptionAPI
      .getInvoicesByRecruiter(recruiterId)
      .then((r) => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [recruiterId]);

  const refreshLists = async () => {
    if (recruiterId == null) return;
    const [subsRes, invRes] = await Promise.all([
      subscriptionAPI.getByRecruiter(recruiterId),
      subscriptionAPI.getInvoicesByRecruiter(recruiterId),
    ]);
    setSubscriptions(Array.isArray(subsRes.data) ? subsRes.data : []);
    setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
  };

  const handleSubscribe = async (plan) => {
    if (recruiterId == null || recruiterId <= 0) {
      toast.error('Missing recruiter id — please sign in again.');
      return;
    }
    const code = plan.code;
    if (!code) {
      toast.error('Invalid plan.');
      return;
    }

    setLoading(true);
    try {
      const orderRes = await subscriptionAPI.createOrder({
        recruiterId,
        plan: code,
        billingEmail: user?.email,
      });
      const data = orderRes.data;

      if (code === 'FREE' || !data?.orderId) {
        toast.success(data?.message || 'Free plan activated.');
        await refreshLists();
        return;
      }

      const { orderId, amount, keyId } = data;

      const options = {
        key: keyId,
        amount: typeof amount === 'number' ? amount : Number(amount),
        currency: 'INR',
        name: 'HireConnect',
        description: `${plan.displayName || code} Plan`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await subscriptionAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              billingEmail: user?.email,
            });
            toast.success(`${plan.displayName || code} subscription activated. Invoice emailed to ${user?.email || 'your inbox'}.`);
            await refreshLists();
          } catch {
            toast.error('Payment verification failed');
          }
        },
        prefill: { email: user?.email },
        theme: { color: '#4f8ef7' },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.error('Razorpay not loaded. Add the Razorpay script to index.html.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create order'));
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (subscriptionId) => {
    setLoading(true);
    try {
      const orderRes = await subscriptionAPI.renew(subscriptionId);
      const data = orderRes.data;

      if (!data?.orderId) {
        toast.error('Failed to create renewal order.');
        return;
      }

      const { orderId, amount, keyId, plan } = data;

      const options = {
        key: keyId,
        amount: typeof amount === 'number' ? amount : Number(amount),
        currency: 'INR',
        name: 'HireConnect',
        description: `Renew ${plan} Plan`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await subscriptionAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              billingEmail: user?.email,
            });
            toast.success(`${plan} subscription renewed successfully!`);
            await refreshLists();
          } catch {
            toast.error('Payment verification failed for renewal.');
          }
        },
        prefill: { email: user?.email },
        theme: { color: '#4f8ef7' },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.error('Razorpay not loaded. Add the Razorpay script to index.html.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to process renewal'));
    } finally {
      setLoading(false);
    }
  };

  const handleMockSubscribe = async (plan) => {
    if (recruiterId == null || recruiterId <= 0) return;
    setLoading(true);
    try {
      const orderRes = await subscriptionAPI.createOrder({
        recruiterId,
        plan: plan.code,
        billingEmail: user?.email,
      });
      const data = orderRes.data;
      if (data?.orderId) {
        await subscriptionAPI.verifyPayment({
          razorpayOrderId: data.orderId,
          razorpayPaymentId: "MOCK_PAYMENT_ID",
          razorpaySignature: "MOCK_SIGNATURE",
          billingEmail: user?.email,
        });
        toast.success(`Mock payment successful. ${plan.displayName || plan.code} activated.`);
        await refreshLists();
      }
    } catch (err) {
      toast.error('Mock payment failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoicePdf = async (invoiceId) => {
    if (recruiterId == null || recruiterId <= 0) {
      toast.error('Missing recruiter id — please sign in again.');
      return;
    }
    try {
      const res = await subscriptionAPI.downloadInvoicePdf(invoiceId, recruiterId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hireconnect-invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      let msg = 'Could not download invoice PDF';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const txt = await data.text();
          if (txt && txt.length < 500) msg = txt;
        } catch (_) {
          /* ignore */
        }
      } else {
        msg = getErrorMessage(err, msg);
      }
      toast.error(msg);
    }
  };

  const handleInvoiceClick = async (invoice) => {
    setSelectedInvoice(invoice);
    setAnalyticsLoading(true);
    try {
      const res = await analyticsAPI.getRecruiterStats(recruiterId);
      setAnalytics(res.data);
    } catch (err) {
      toast.error('Could not fetch analytics for this invoice');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
    setAnalytics(null);
  };

  const handleCancel = async (subscriptionId) => {
    if (!window.confirm('Cancel this subscription?')) return;
    try {
      await subscriptionAPI.cancel(subscriptionId);
      setSubscriptions((prev) => prev.filter((s) => s.subscriptionId !== subscriptionId));
      toast.success('Subscription cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  return (
    <div className="sub-page page">
      <div className="container sub-container">
        <div className="sub-header fade-in">
          <h1 className="section-title">Subscription Plans</h1>
          <p className="section-sub">
            Prices and tiers come from the subscription service ({catalogLoading ? 'loading…' : `${displayPlans.length} plans`}).
            After payment, an invoice is emailed to your login address.
          </p>
        </div>

        <div className="plans-grid fade-in">
          {displayPlans.map((plan) => (
            <div key={plan.code} className={`plan-card card ${plan.code === 'PROFESSIONAL' ? 'plan-featured' : ''}`}>
              {plan.code === 'PROFESSIONAL' && <div className="plan-badge">Popular</div>}
              <div className="plan-name">{plan.displayName || plan.code}</div>
              <div className="plan-price">
                <span className="plan-currency">₹</span>
                <span className="plan-amount">{Number(plan.amountInr || 0).toLocaleString()}</span>
                <span className="plan-period">/{plan.billingPeriod || 'year'}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text3)', marginBottom: 8 }}>{plan.summary}</p>
              <ul className="plan-features">
                {(plan.features || []).map((f) => (
                  <li key={f}>
                    <span className="plan-check">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`btn ${plan.code === 'PROFESSIONAL' ? 'btn-primary' : 'btn-ghost'} plan-btn`}
                onClick={() => handleSubscribe(plan)}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : null}
                {plan.code === 'FREE' ? 'Activate Free' : `Get ${plan.displayName || plan.code}`}
              </button>
              {plan.code !== 'FREE' && (
                <button
                  className="btn btn-ghost plan-btn"
                  style={{ marginTop: '8px', fontSize: '0.8rem' }}
                  onClick={() => handleMockSubscribe(plan)}
                  disabled={loading}
                >
                  Simulate Payment (Test)
                </button>
              )}
            </div>
          ))}
        </div>

        {subscriptions.length > 0 && (
          <div className="sub-section fade-in">
            <h2 className="sub-section-title">Your subscriptions</h2>
            <div className="subs-list">
              {subscriptions.map((sub) => (
                <div key={sub.subscriptionId} className="sub-item card">
                  <div className="sub-item-info">
                    <div className="sub-plan-name">{sub.plan}</div>
                    <div className="sub-dates">
                      {formatDt(sub.startDate)} → {formatDt(sub.endDate)}
                    </div>
                  </div>
                  <span className={`badge badge-${sub.status === 'ACTIVE' ? 'green' : 'gray'}`}>{sub.status}</span>
                  <div className="sub-actions" style={{ display: 'flex', gap: '8px' }}>
                    {sub.status === 'ACTIVE' && sub.plan !== 'FREE' && (
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleRenew(sub.subscriptionId)}
                        disabled={loading}
                      >
                        {loading ? <span className="spinner" /> : null} Renew
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancel(sub.subscriptionId)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="sub-section fade-in">
            <h2 className="sub-section-title">Billing history</h2>
            <p className="section-sub" style={{ marginBottom: 12 }}>
              Each payment generates an invoice row here and sends the same details to your email when SMTP is configured on
              the subscription service.
            </p>
            <div className="invoices-table">
              <div className="inv-header">
                <span>Invoice</span>
                <span>Plan</span>
                <span>Amount</span>
                <span>Paid</span>
                <span>Status</span>
                <span>PDF</span>
              </div>
              {invoices.map((inv) => (
                <div key={inv.invoiceId} className="inv-row" onClick={() => handleInvoiceClick(inv)}>
                  <span className="inv-id">#{inv.invoiceId}</span>
                  <span>{inv.planName}</span>
                  <span className="inv-amount">₹{Number(inv.amount || 0).toLocaleString()}</span>
                  <span>{formatDt(inv.paymentDate)}</span>
                  <span className={`badge badge-${inv.status === 'PAID' ? 'green' : 'yellow'}`}>{inv.status}</span>
                  <span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm inv-pdf-btn"
                      onClick={(e) => { e.stopPropagation(); handleDownloadInvoicePdf(inv.invoiceId); }}
                    >
                      Download
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Invoice Modal */}
        {selectedInvoice && (
          <div className="invoice-modal-overlay" onClick={closeInvoiceModal}>
            <div className="invoice-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="invoice-modal-header">
                <div className="invoice-modal-title">
                  🧾 Invoice #{selectedInvoice.invoiceId}
                </div>
                <button className="invoice-modal-close" onClick={closeInvoiceModal}>×</button>
              </div>
              
              <div className="invoice-modal-body">
                <div className="invoice-details-grid">
                  <div className="invoice-detail-item">
                    <span className="invoice-detail-label">Plan</span>
                    <span className="invoice-detail-value">{selectedInvoice.planName}</span>
                  </div>
                  <div className="invoice-detail-item">
                    <span className="invoice-detail-label">Amount Paid</span>
                    <span className="invoice-detail-value" style={{ color: 'var(--accent)', fontWeight: '700' }}>
                      ₹{Number(selectedInvoice.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="invoice-detail-item">
                    <span className="invoice-detail-label">Status</span>
                    <span className="invoice-detail-value" style={{ color: selectedInvoice.status === 'PAID' ? 'var(--green)' : 'var(--text)' }}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div className="invoice-detail-item">
                    <span className="invoice-detail-label">Date</span>
                    <span className="invoice-detail-value">{formatDt(selectedInvoice.paymentDate)}</span>
                  </div>
                </div>

                <div>
                  <div className="invoice-analytics-header">Recruiter Analytics Snapshot</div>
                  {analyticsLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}><span className="spinner" /></div>
                  ) : analytics ? (
                    <div className="invoice-analytics-grid">
                      <div className="metric-card">
                        <div className="metric-header">
                          <span className="metric-icon">💼</span>
                          <span>Jobs Posted</span>
                        </div>
                        <div className="metric-value">{analytics.totalJobs}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-header">
                          <span className="metric-icon">📄</span>
                          <span>Applications Received</span>
                        </div>
                        <div className="metric-value">{analytics.totalApplications}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-header">
                          <span className="metric-icon">📅</span>
                          <span>Interviews Scheduled</span>
                        </div>
                        <div className="metric-value">{analytics.interviewsScheduledCount}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-header">
                          <span className="metric-icon">🎉</span>
                          <span>Offers Given</span>
                        </div>
                        <div className="metric-value">{analytics.offeredCount}</div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text3)' }}>No analytics available.</p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleDownloadInvoicePdf(selectedInvoice.invoiceId)}
                  >
                    Download PDF Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
