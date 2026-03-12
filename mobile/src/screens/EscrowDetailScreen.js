import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Keyboard } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing } from '../utils/theme';

const STATUS_LABELS = {
  pending_seller: 'Awaiting Seller Confirmation',
  pending_payment: 'Awaiting Buyer Payment',
  payment_received: 'Payment Verified - Ready to Ship',
  shipped: 'Shipped - Awaiting Delivery',
  delivered: 'Delivered - Awaiting Admin Release',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending_seller: colors.warning,
  pending_payment: colors.warning,
  payment_received: colors.accent,
  shipped: colors.wtb,
  delivered: colors.wts,
  completed: colors.success,
  disputed: colors.error,
  cancelled: colors.textLight,
};

export default function EscrowDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [escrow, setEscrow] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [tracking, setTracking] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [rateStars, setRateStars] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [wireInstructions, setWireInstructions] = useState('');
  const [selectedPayMethod, setSelectedPayMethod] = useState(null);
  const [sellerPayoutMethod, setSellerPayoutMethod] = useState(null);

  useEffect(() => {
    loadEscrow();
  }, [id]);

  async function loadEscrow() {
    try {
      const data = await api.getEscrow(id);
      setEscrow(data.escrow);
      setEvents(data.events);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function performAction(action, successMsg) {
    setActionLoading(true);
    try {
      await action();
      Alert.alert('Success', successMsg);
      loadEscrow();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;
  if (!escrow) return <View style={styles.center}><Text>Escrow not found</Text></View>;

  const isBuyer = user.id === escrow.buyer_id;
  const isSeller = user.id === escrow.seller_id;
  const isAdmin = user.is_admin;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
      {/* Status */}
      <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[escrow.status] }]}>
        <Text style={styles.statusText}>{STATUS_LABELS[escrow.status]}</Text>
      </View>

      {/* Amount */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Invoice Total</Text>
        <Text style={styles.amount}>${Number(escrow.amount).toLocaleString()}</Text>
        <View style={styles.feeBreakdown}>
          <View style={styles.feeBreakdownRow}>
            <Text style={styles.feeText}>Escrow Fee (0.5%)</Text>
            <Text style={styles.feeText}>${Number(escrow.escrow_fee).toFixed(2)}</Text>
          </View>
          {escrow.payment_method === 'wire' && Number(escrow.wire_fee || 0) > 0 && (
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeText}>Wire Transfer Fee</Text>
              <Text style={styles.feeText}>${Number(escrow.wire_fee).toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.feeBreakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs, marginTop: spacing.xs }]}>
            <Text style={[styles.feeText, { fontWeight: '700', color: colors.text }]}>Buyer Pays</Text>
            <Text style={[styles.feeText, { fontWeight: '700', color: colors.primary }]}>${Number(escrow.buyer_total || (parseFloat(escrow.amount) + parseFloat(escrow.escrow_fee) + parseFloat(escrow.wire_fee || 0))).toFixed(2)}</Text>
          </View>
          <View style={styles.feeBreakdownRow}>
            <Text style={styles.feeText}>Seller Receives</Text>
            <Text style={[styles.feeText, { color: colors.success }]}>${Number(escrow.seller_payout).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deal Details</Text>
        <DetailRow label="Product" value={escrow.product_description} />
        <DetailRow label="Buyer" value={escrow.buyer_name} />
        <DetailRow label="Seller" value={escrow.seller_name} />
        {escrow.fee_payer && (
          <DetailRow label="Fee Paid By" value={escrow.fee_payer === 'seller' ? 'Seller' : 'Buyer'} />
        )}
        {escrow.seller_payout_method && (
          <DetailRow label="Seller Payout" value={escrow.seller_payout_method === 'usdt' ? 'USDT' : 'Wire Transfer'} />
        )}
        {escrow.tracking_number && <DetailRow label="Tracking" value={escrow.tracking_number} />}
        {escrow.wire_proof_url && <DetailRow label="Payment Proof" value={escrow.wire_proof_url} />}
        <DetailRow label="Created" value={new Date(escrow.created_at).toLocaleDateString()} />
      </View>

      {/* Actions based on status and role */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        {/* Seller confirms deal + chooses payout method */}
        {isSeller && escrow.status === 'pending_seller' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>The buyer wants to start an escrow with you. Review the details and choose how you'd like to receive your payout.</Text>

            <Text style={[styles.actionHint, { fontWeight: '700', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm }]}>How do you want to get paid?</Text>
            <View style={styles.payMethodTabs}>
              <TouchableOpacity
                style={[styles.payMethodTab, sellerPayoutMethod === 'wire' && styles.payMethodTabActive]}
                onPress={() => setSellerPayoutMethod('wire')}
              >
                <Text style={[styles.payMethodTabText, sellerPayoutMethod === 'wire' && styles.payMethodTabTextActive]}>Wire Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payMethodTab, sellerPayoutMethod === 'usdt' && styles.payMethodTabActive]}
                onPress={() => setSellerPayoutMethod('usdt')}
              >
                <Text style={[styles.payMethodTabText, sellerPayoutMethod === 'usdt' && styles.payMethodTabTextActive]}>USDT</Text>
              </TouchableOpacity>
            </View>

            {sellerPayoutMethod === 'wire' && (
              <View style={styles.payoutInfoBox}>
                <Text style={styles.payoutInfoText}>You'll receive ${Number(escrow.seller_payout || escrow.amount).toLocaleString()} via wire transfer after the deal completes. Admin will contact you for your bank details.</Text>
              </View>
            )}
            {sellerPayoutMethod === 'usdt' && (
              <View style={styles.payoutInfoBox}>
                <Text style={styles.payoutInfoText}>You'll receive ${Number(escrow.seller_payout || escrow.amount).toLocaleString()} in USDT after the deal completes. Admin will contact you for your wallet address.</Text>
              </View>
            )}

            <Button
              title="Confirm Deal"
              onPress={() => {
                if (!sellerPayoutMethod) {
                  Alert.alert('Error', 'Please choose how you want to receive your payout');
                  return;
                }
                performAction(
                  () => api.confirmEscrow(id, sellerPayoutMethod),
                  'Deal confirmed! Buyer can now send payment.'
                );
              }}
              loading={actionLoading}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              title="Decline"
              variant="danger"
              onPress={() => performAction(() => api.cancelEscrow(id), 'Escrow cancelled.')}
              loading={actionLoading}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}

        {/* Buyer chooses payment method and sends proof */}
        {isBuyer && escrow.status === 'pending_payment' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>Choose your payment method:</Text>

            {/* Payment method tabs */}
            <View style={styles.payMethodTabs}>
              <TouchableOpacity
                style={[styles.payMethodTab, selectedPayMethod === 'wire' && styles.payMethodTabActive]}
                onPress={() => setSelectedPayMethod('wire')}
              >
                <Text style={[styles.payMethodTabText, selectedPayMethod === 'wire' && styles.payMethodTabTextActive]}>Wire Transfer</Text>
                <Text style={[styles.payMethodTabSub, selectedPayMethod === 'wire' && styles.payMethodTabTextActive]}>+ $25 wire fee</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payMethodTab, selectedPayMethod === 'usdt' && styles.payMethodTabActive]}
                onPress={() => setSelectedPayMethod('usdt')}
              >
                <Text style={[styles.payMethodTabText, selectedPayMethod === 'usdt' && styles.payMethodTabTextActive]}>USDT</Text>
                <Text style={[styles.payMethodTabSub, selectedPayMethod === 'usdt' && styles.payMethodTabTextActive]}>No extra fee</Text>
              </TouchableOpacity>
            </View>

            {/* Wire Transfer details */}
            {selectedPayMethod === 'wire' && (
              <>
                <View style={styles.paymentInstructions}>
                  <Text style={styles.paymentTitle}>Wire Transfer Details</Text>
                  <View style={styles.payTotalBox}>
                    <Text style={styles.payTotalLabel}>Amount to Wire</Text>
                    <Text style={styles.payTotalAmount}>${(parseFloat(escrow.amount) + parseFloat(escrow.amount) * 0.005 + 25).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.payTotalBreakdown}>
                      ${Number(escrow.amount).toLocaleString()} + ${(parseFloat(escrow.amount) * 0.005).toFixed(2)} fee + $25.00 wire
                    </Text>
                  </View>

                  <Text style={[styles.paymentDetail, { fontWeight: '700', marginBottom: 4 }]}>Beneficiary</Text>
                  <Text style={styles.paymentDetail}>Account Name: CP WIRELESS 1 INC</Text>
                  <Text style={styles.paymentDetail}>Account Type: Checking</Text>
                  <Text style={styles.paymentDetail}>Address: 3034 Northwest 72nd Avenue, Miami, FL 33122</Text>

                  <Text style={[styles.paymentDetail, { fontWeight: '700', marginTop: spacing.sm, marginBottom: 4 }]}>Bank Details</Text>
                  <Text style={styles.paymentDetail} selectable>Account Number: 200002276186</Text>
                  <Text style={styles.paymentDetail} selectable>Routing Number: 064209588</Text>
                  <Text style={styles.paymentDetail}>Bank: Thread Bank</Text>
                  <Text style={styles.paymentDetail}>Bank Address: 210 E Main St, Rogersville TN 37857</Text>

                  <Text style={styles.paymentNote}>
                    Use your escrow ID as the reference/memo.
                  </Text>
                </View>
                <Input
                  label="Wire Proof (URL or receipt details)"
                  placeholder="Paste receipt link or describe payment"
                  value={proofUrl}
                  onChangeText={setProofUrl}
                  multiline
                />
                <Button
                  title="Upload Wire Proof"
                  onPress={() => {
                    if (!proofUrl.trim()) { Alert.alert('Error', 'Please enter proof details'); return; }
                    performAction(() => api.uploadWireProof(id, proofUrl), 'Proof uploaded! Waiting for admin verification.');
                  }}
                  loading={actionLoading}
                />
              </>
            )}

            {/* USDT details - choose network */}
            {selectedPayMethod === 'usdt' && (
              <>
                <View style={styles.paymentInstructions}>
                  <Text style={styles.paymentTitle}>Send USDT Payment</Text>
                  <View style={styles.payTotalBox}>
                    <Text style={styles.payTotalLabel}>Amount to Send</Text>
                    <Text style={styles.payTotalAmount}>${(parseFloat(escrow.amount) + parseFloat(escrow.amount) * 0.005).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</Text>
                    <Text style={styles.payTotalBreakdown}>
                      ${Number(escrow.amount).toLocaleString()} + ${(parseFloat(escrow.amount) * 0.005).toFixed(2)} fee
                    </Text>
                  </View>

                  <Text style={[styles.paymentDetail, { fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm }]}>Choose Network</Text>

                  {/* TRC-20 */}
                  <View style={styles.networkCard}>
                    <View style={styles.networkHeader}>
                      <Text style={styles.networkBadgeTrc}>TRC-20</Text>
                      <Text style={styles.networkName}>Tron Network</Text>
                    </View>
                    <View style={styles.qrContainer}>
                      <QRCode value="TTrMfykhVgGNVxzqbiDfowuVN2guWax73S" size={160} />
                    </View>
                    <Text style={styles.walletAddress} selectable>
                      TTrMfykhVgGNVxzqbiDfowuVN2guWax73S
                    </Text>
                  </View>

                  {/* ERC-20 */}
                  <View style={[styles.networkCard, { marginTop: spacing.sm }]}>
                    <View style={styles.networkHeader}>
                      <Text style={styles.networkBadgeErc}>ERC-20</Text>
                      <Text style={styles.networkName}>Ethereum Network</Text>
                    </View>
                    <View style={styles.qrContainer}>
                      <QRCode value="0x2F834f53c014Ab13fEe0779Df306301296bA73b2" size={160} />
                    </View>
                    <Text style={styles.walletAddress} selectable>
                      0x2F834f53c014Ab13fEe0779Df306301296bA73b2
                    </Text>
                  </View>

                  <Text style={styles.paymentNote}>
                    Send to either network above. After sending, paste your transaction hash below.
                  </Text>
                </View>
                <Input
                  label="Transaction Hash / Proof"
                  placeholder="Paste USDT transaction hash"
                  value={proofUrl}
                  onChangeText={setProofUrl}
                  multiline
                />
                <Button
                  title="Upload USDT Proof"
                  onPress={() => {
                    if (!proofUrl.trim()) { Alert.alert('Error', 'Please enter proof details'); return; }
                    performAction(() => api.uploadWireProof(id, proofUrl), 'Proof uploaded! Waiting for admin verification.');
                  }}
                  loading={actionLoading}
                />
              </>
            )}
          </View>
        )}

        {/* Admin verifies payment */}
        {isAdmin && escrow.status === 'pending_payment' && escrow.wire_proof_url && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>
              Buyer uploaded wire proof: {escrow.wire_proof_url}{'\n\n'}Verify you received the funds, then confirm.
            </Text>
            <Button
              title="Confirm Payment Received"
              onPress={() => {
                Alert.alert('Verify Payment', `Confirm you received $${escrow.amount} from ${escrow.buyer_name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm', onPress: () => performAction(() => api.verifyPayment(id), 'Payment verified! Seller can now ship.') },
                ]);
              }}
              loading={actionLoading}
            />
          </View>
        )}

        {/* Seller ships */}
        {isSeller && escrow.status === 'payment_received' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>Payment has been verified. Ship the product and enter the tracking number.</Text>
            <Input
              label="Tracking Number"
              placeholder="Enter shipping tracking number"
              value={tracking}
              onChangeText={setTracking}
            />
            <Button
              title="Mark as Shipped"
              onPress={() => {
                if (!tracking.trim()) { Alert.alert('Error', 'Please enter tracking number'); return; }
                performAction(() => api.shipEscrow(id, tracking), 'Marked as shipped!');
              }}
              loading={actionLoading}
            />
          </View>
        )}

        {/* Buyer confirms receipt */}
        {isBuyer && escrow.status === 'shipped' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>
              Tracking: {escrow.tracking_number}{'\n\n'}Once you receive the product and verify the condition, confirm receipt.
            </Text>
            <Button
              title="Confirm Product Received"
              onPress={() => {
                Alert.alert('Confirm Receipt', 'Have you received the product and verified it matches the deal?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm', onPress: () => performAction(() => api.confirmReceipt(id), 'Receipt confirmed! Admin will release payment.') },
                ]);
              }}
              loading={actionLoading}
            />
          </View>
        )}

        {/* Admin releases payment */}
        {isAdmin && escrow.status === 'delivered' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>
              Buyer confirmed receipt. Release ${escrow.seller_payout} to seller (fee: ${escrow.escrow_fee}).
            </Text>
            <Button
              title={`Release $${Number(escrow.seller_payout).toFixed(2)} to Seller`}
              onPress={() => {
                Alert.alert('Release Payment', `Release $${escrow.seller_payout} to ${escrow.seller_name}?\nFee collected: $${escrow.escrow_fee}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Release', onPress: () => performAction(() => api.releasePayment(id), 'Payment released! Transaction complete.') },
                ]);
              }}
              loading={actionLoading}
            />
          </View>
        )}

        {/* Dispute option */}
        {(isBuyer || isSeller) && !['completed', 'cancelled', 'disputed'].includes(escrow.status) && (
          <View style={[styles.actionGroup, { marginTop: spacing.md }]}>
            <Input
              label="Dispute Reason"
              placeholder="Describe the issue..."
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
            />
            <Button
              title="Open Dispute"
              variant="danger"
              onPress={() => {
                if (!disputeReason.trim()) { Alert.alert('Error', 'Please describe the issue'); return; }
                Alert.alert('Open Dispute', 'This will pause the escrow and notify the admin.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Dispute', style: 'destructive', onPress: () => performAction(() => api.disputeEscrow(id, disputeReason), 'Dispute opened. Admin will review.') },
                ]);
              }}
              loading={actionLoading}
            />
          </View>
        )}

        {/* Admin dispute resolution */}
        {isAdmin && escrow.status === 'disputed' && (
          <View style={[styles.actionGroup, { marginTop: spacing.md }]}>
            <Text style={styles.actionHint}>
              This escrow is disputed. Review the timeline and resolve.
            </Text>
            {escrow.admin_notes ? (
              <View style={styles.disputeNotes}>
                <Text style={styles.disputeNotesLabel}>Dispute Notes:</Text>
                <Text style={styles.disputeNotesText}>{escrow.admin_notes}</Text>
              </View>
            ) : null}
            <Button
              title="Release Payment to Seller"
              onPress={() => {
                Alert.alert('Resolve Dispute', `Release $${escrow.seller_payout} to ${escrow.seller_name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Release', onPress: () => performAction(() => api.resolveDispute(id, 'release'), 'Payment released to seller.') },
                ]);
              }}
              loading={actionLoading}
            />
            <Button
              title="Refund Buyer"
              variant="outline"
              onPress={() => {
                Alert.alert('Resolve Dispute', `Refund $${escrow.amount} to ${escrow.buyer_name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Refund', onPress: () => performAction(() => api.resolveDispute(id, 'refund'), 'Buyer refunded. Escrow cancelled.') },
                ]);
              }}
              loading={actionLoading}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}

        {/* Disputed status - non-admin */}
        {!isAdmin && escrow.status === 'disputed' && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>
              This escrow is under dispute. The admin is reviewing the case and will resolve it.
            </Text>
          </View>
        )}

        {/* Cancel option */}
        {(isBuyer || isSeller) && ['pending_seller', 'pending_payment'].includes(escrow.status) && (
          <Button
            title="Cancel Escrow"
            variant="outline"
            onPress={() => {
              Alert.alert('Cancel Escrow', 'Are you sure?', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', style: 'destructive', onPress: () => performAction(() => api.cancelEscrow(id), 'Escrow cancelled.') },
              ]);
            }}
            loading={actionLoading}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {/* Completed - rating prompt for buyer */}
        {escrow.status === 'completed' && isBuyer && !ratingSubmitted && (
          <View style={styles.actionGroup}>
            <Text style={styles.actionHint}>Transaction complete! Rate your experience with {escrow.seller_name}.</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setRateStars(s)}>
                  <Text style={[styles.starIcon, s <= rateStars && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              label="Feedback"
              placeholder="How was your experience?"
              value={rateComment}
              onChangeText={setRateComment}
              multiline
            />
            <Button
              title="Submit Rating"
              onPress={() => {
                if (!rateComment.trim()) { Alert.alert('Error', 'Please enter feedback'); return; }
                performAction(
                  () => api.rateUser({ to_user_id: escrow.seller_id, stars: rateStars, comment: rateComment, escrow_id: id }),
                  'Rating submitted! It will appear after admin review.'
                );
                setRatingSubmitted(true);
              }}
              loading={actionLoading}
            />
          </View>
        )}
        {escrow.status === 'completed' && (isSeller || ratingSubmitted) && (
          <Text style={styles.completedText}>Transaction complete.</Text>
        )}
      </View>

      {/* Event Timeline */}
      {events.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {events.map(ev => (
            <View key={ev.id} style={styles.event}>
              <View style={styles.eventDot} />
              <View style={styles.eventContent}>
                <Text style={styles.eventAction}>{ev.action.replace(/_/g, ' ')}</Text>
                {ev.performed_by_name && <Text style={styles.eventBy}>by {ev.performed_by_name}</Text>}
                {ev.details ? <Text style={styles.eventDetails}>{ev.details}</Text> : null}
                <Text style={styles.eventTime}>{new Date(ev.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBar: {
    padding: spacing.md,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  amountCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  amountLabel: { fontSize: 13, color: colors.textSecondary },
  amount: { fontSize: 36, fontWeight: '800', color: colors.primary, marginVertical: spacing.xs },
  feeBreakdown: { width: '100%', marginTop: spacing.sm },
  feeBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  feeText: { fontSize: 13, color: colors.textLight },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1, textAlign: 'right', marginLeft: spacing.md },
  actionGroup: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
  },
  actionHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  starIcon: {
    fontSize: 36,
    color: colors.border,
  },
  starActive: {
    color: colors.star,
  },
  payMethodTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  payMethodTab: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  payMethodTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  payMethodTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  payMethodTabTextActive: {
    color: '#fff',
  },
  payMethodTabSub: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  payTotalBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  payTotalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  payTotalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginVertical: 4,
  },
  payTotalBreakdown: {
    fontSize: 11,
    color: colors.textLight,
  },
  payoutInfoBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  payoutInfoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  networkCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  networkBadgeTrc: {
    backgroundColor: '#e53935',
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  networkBadgeErc: {
    backgroundColor: '#627eea',
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  networkName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  walletAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
  paymentInstructions: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  paymentDetail: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  paymentNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  disputeNotes: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  disputeNotesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  disputeNotesText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  completedText: {
    fontSize: 14,
    color: colors.success,
    textAlign: 'center',
    fontWeight: '600',
  },
  event: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  eventContent: { flex: 1 },
  eventAction: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  eventBy: { fontSize: 12, color: colors.textSecondary },
  eventDetails: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  eventTime: { fontSize: 11, color: colors.textLight, marginTop: 2 },
});
