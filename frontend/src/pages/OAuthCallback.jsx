import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useOrgStore } from '../store';
import axios from 'axios';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const fetchStatus = useOrgStore(s => s.fetchStatus);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const oauthError = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (oauthError) {
        setStatus('error');
        setError(errorDesc || oauthError);
        return;
      }

      if (!code) {
        setStatus('error');
        setError("No authorization code received from Salesforce.");
        return;
      }

      // Get pending details from localStorage
      const pendingData = localStorage.getItem('pending_oauth');
      if (!pendingData) {
        setStatus('error');
        setError("OAuth session expired or invalid. Please try again.");
        return;
      }

      try {
        const params = JSON.parse(pendingData);
        
        // Call backend callback endpoint
        const response = await axios.get(`http://localhost:8000/api/oauth-callback`, {
          params: {
            code,
            environment: params.environment,
            client_id: params.client_id,
            client_secret: params.client_secret,
            domain: params.domain,
            redirect_uri: params.redirect_uri,
            alias: params.alias
          }
        });

        if (response.data.success) {
          setStatus('success');
          localStorage.removeItem('pending_oauth');
          await fetchStatus();
          // Auto redirect after 2 seconds
          setTimeout(() => navigate('/connections'), 2000);
        } else {
          throw new Error(response.data.message || "Connection failed");
        }
      } catch (err) {
        console.error("OAuth Exchange Error:", err);
        setStatus('error');
        setError(err.response?.data?.detail || err.message || "Failed to exchange authorization code.");
      }
    };

    processCallback();
  }, [searchParams, navigate, fetchStatus]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card p-10 max-w-md w-full space-y-6"
      >
        {status === 'processing' && (
          <>
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-accent-blue" size={48} style={{ color: 'var(--color-accent-blue)' }} />
            </div>
            <h2 className="text-xl font-bold">Authenticating...</h2>
            <p className="text-sm text-tertiary" style={{ color: 'var(--color-text-tertiary)' }}>
              Exchanging authorization code for a secure Salesforce session. Please wait.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <CheckCircle2 className="text-status-success" size={48} style={{ color: 'var(--color-status-success)' }} />
            </div>
            <h2 className="text-xl font-bold">Connection Successful!</h2>
            <p className="text-sm text-tertiary" style={{ color: 'var(--color-text-tertiary)' }}>
              Your Salesforce org is now connected via OAuth 2.0. Redirecting you back...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <XCircle className="text-status-error" size={48} style={{ color: 'var(--color-status-error)' }} />
            </div>
            <h2 className="text-xl font-bold">Authentication Failed</h2>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
            <button 
              onClick={() => navigate('/connections')}
              className="w-full py-2 bg-white/10 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors"
            >
              Back to Connections
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
