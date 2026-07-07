"""add expense vouchers

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-07 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── EXPENSE VOUCHERS ───
    op.create_table(
        'expense_vouchers',
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
        sa.ForeignKeyConstraint(['reversal_of_id'], ['expense_vouchers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expense_vouchers_bank_account_id'), 'expense_vouchers', ['bank_account_id'], unique=False)
    op.create_index(op.f('ix_expense_vouchers_branch_id'), 'expense_vouchers', ['branch_id'], unique=False)
    op.create_index(op.f('ix_expense_vouchers_cash_account_id'), 'expense_vouchers', ['cash_account_id'], unique=False)
    op.create_index(op.f('ix_expense_vouchers_id'), 'expense_vouchers', ['id'], unique=False)
    op.create_index(op.f('ix_expense_vouchers_voucher_number'), 'expense_vouchers', ['voucher_number'], unique=True)


def downgrade() -> None:
    op.drop_table('expense_vouchers')
