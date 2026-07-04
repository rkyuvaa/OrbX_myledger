"""initial migration

Revision ID: 0001
Revises: 
Create Date: 2026-07-03 23:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── USERS ───
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_superuser', sa.Boolean(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('last_login', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # ─── COMPANY PROFILE ───
    op.create_table(
        'company_profile',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('gstin', sa.String(length=20), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('fy_start_month', sa.Integer(), nullable=False),
        sa.Column('fy_start_year', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_company_profile_id'), 'company_profile', ['id'], unique=False)

    # ─── VOUCHER SEQUENCES ───
    op.create_table(
        'voucher_sequences',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_type', sa.String(length=10), nullable=False),
        sa.Column('prefix', sa.String(length=20), nullable=False),
        sa.Column('current_number', sa.Integer(), nullable=False),
        sa.Column('fy_start', sa.Integer(), nullable=False),
        sa.Column('fy_end', sa.Integer(), nullable=False),
        sa.Column('padding', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_voucher_sequences_id'), 'voucher_sequences', ['id'], unique=False)

    # ─── BANK ACCOUNTS ───
    op.create_table(
        'bank_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('account_number', sa.String(length=50), nullable=True),
        sa.Column('ifsc_code', sa.String(length=20), nullable=True),
        sa.Column('bank_branch_name', sa.String(length=255), nullable=True),
        sa.Column('opening_balance', sa.Float(), nullable=False),
        sa.Column('opening_date', sa.Date(), nullable=False),
        sa.Column('current_balance', sa.Float(), nullable=False),
        sa.Column('is_overdraft_allowed', sa.Boolean(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_accounts_id'), 'bank_accounts', ['id'], unique=False)

    # ─── CASH ACCOUNTS ───
    op.create_table(
        'cash_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('opening_balance', sa.Float(), nullable=False),
        sa.Column('opening_date', sa.Date(), nullable=False),
        sa.Column('current_balance', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cash_accounts_id'), 'cash_accounts', ['id'], unique=False)

    # ─── BRANCHES ───
    op.create_table(
        'branches',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('contact_person', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_branches_code'), 'branches', ['code'], unique=True)
    op.create_index(op.f('ix_branches_id'), 'branches', ['id'], unique=False)

    # ─── RECEIPT VOUCHERS ───
    op.create_table(
        'receipt_vouchers',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_number', sa.String(length=30), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('branch_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('received_from', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_mode', sa.String(length=20), nullable=False),
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('cash_account_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('is_reversed', sa.Boolean(), nullable=False),
        sa.Column('reversal_of_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('posted_by_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cash_account_id'], ['cash_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reversal_of_id'], ['receipt_vouchers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_receipt_vouchers_bank_account_id'), 'receipt_vouchers', ['bank_account_id'], unique=False)
    op.create_index(op.f('ix_receipt_vouchers_branch_id'), 'receipt_vouchers', ['branch_id'], unique=False)
    op.create_index(op.f('ix_receipt_vouchers_cash_account_id'), 'receipt_vouchers', ['cash_account_id'], unique=False)
    op.create_index(op.f('ix_receipt_vouchers_id'), 'receipt_vouchers', ['id'], unique=False)
    op.create_index(op.f('ix_receipt_vouchers_voucher_number'), 'receipt_vouchers', ['voucher_number'], unique=True)

    # ─── PAYMENT VOUCHERS ───
    op.create_table(
        'payment_vouchers',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_number', sa.String(length=30), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('branch_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('paid_to', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_mode', sa.String(length=20), nullable=False),
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('cash_account_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('is_reversed', sa.Boolean(), nullable=False),
        sa.Column('reversal_of_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('posted_by_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cash_account_id'], ['cash_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reversal_of_id'], ['payment_vouchers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_vouchers_bank_account_id'), 'payment_vouchers', ['bank_account_id'], unique=False)
    op.create_index(op.f('ix_payment_vouchers_branch_id'), 'payment_vouchers', ['branch_id'], unique=False)
    op.create_index(op.f('ix_payment_vouchers_cash_account_id'), 'payment_vouchers', ['cash_account_id'], unique=False)
    op.create_index(op.f('ix_payment_vouchers_id'), 'payment_vouchers', ['id'], unique=False)
    op.create_index(op.f('ix_payment_vouchers_voucher_number'), 'payment_vouchers', ['voucher_number'], unique=True)

    # ─── FUND TRANSFERS ───
    op.create_table(
        'fund_transfers',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_number', sa.String(length=30), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('from_account_type', sa.String(length=10), nullable=False),
        sa.Column('from_account_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('to_account_type', sa.String(length=10), nullable=False),
        sa.Column('to_account_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('posted_by_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['posted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fund_transfers_id'), 'fund_transfers', ['id'], unique=False)
    op.create_index(op.f('ix_fund_transfers_voucher_number'), 'fund_transfers', ['voucher_number'], unique=True)

    # ─── DAYBOOK ENTRIES ───
    op.create_table(
        'daybook_entries',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('voucher_type', sa.String(length=10), nullable=False),
        sa.Column('voucher_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_number', sa.String(length=30), nullable=False),
        sa.Column('branch_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('particulars', sa.String(length=500), nullable=False),
        sa.Column('debit', sa.Float(), nullable=False),
        sa.Column('credit', sa.Float(), nullable=False),
        sa.Column('payment_mode', sa.String(length=20), nullable=True),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('account_type', sa.String(length=10), nullable=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_daybook_entries_date'), 'daybook_entries', ['date'], unique=False)
    op.create_index(op.f('ix_daybook_entries_id'), 'daybook_entries', ['id'], unique=False)
    op.create_index(op.f('ix_daybook_entries_voucher_id'), 'daybook_entries', ['voucher_id'], unique=False)

    # ─── LEDGER ENTRIES ───
    op.create_table(
        'ledger_entries',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('account_type', sa.String(length=10), nullable=False),
        sa.Column('account_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_type', sa.String(length=10), nullable=False),
        sa.Column('voucher_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('voucher_number', sa.String(length=30), nullable=False),
        sa.Column('debit', sa.Float(), nullable=False),
        sa.Column('credit', sa.Float(), nullable=False),
        sa.Column('running_balance', sa.Float(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ledger_entries_account_id'), 'ledger_entries', ['account_id'], unique=False)
    op.create_index(op.f('ix_ledger_entries_date'), 'ledger_entries', ['date'], unique=False)
    op.create_index(op.f('ix_ledger_entries_id'), 'ledger_entries', ['id'], unique=False)

    # ─── AUDIT LOGS ───
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('ledger_entries')
    op.drop_table('daybook_entries')
    op.drop_table('fund_transfers')
    op.drop_table('payment_vouchers')
    op.drop_table('receipt_vouchers')
    op.drop_table('branches')
    op.drop_table('cash_accounts')
    op.drop_table('bank_accounts')
    op.drop_table('voucher_sequences')
    op.drop_table('company_profile')
    op.drop_table('users')
