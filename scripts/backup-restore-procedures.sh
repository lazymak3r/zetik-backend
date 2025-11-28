#!/bin/bash

# Game Configuration System - Backup and Restore Procedures
# This script provides comprehensive backup and restore functionality for the game configuration system

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_DATABASE="${DB_DATABASE:-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Game Configuration Backup and Restore Tool

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    backup-full             Create full database backup
    backup-configs          Backup only game configurations
    backup-schemas          Backup database schema structure
    restore-full [file]     Restore complete database from backup
    restore-configs [file]  Restore game configurations from backup
    list-backups           List available backups
    validate-backup [file] Validate backup file integrity
    emergency-disable      Emergency disable all dynamic configs
    emergency-restore      Restore to safe fallback state

Options:
    --backup-dir DIR       Custom backup directory (default: ./backups)
    --compress            Compress backup files
    --encrypt             Encrypt backup files (requires gpg)
    --retention DAYS      Auto-cleanup backups older than N days
    --dry-run            Show what would be done without executing

Examples:
    $0 backup-full --compress
    $0 backup-configs --encrypt
    $0 restore-configs backups/game_configs_20231215_143022.sql
    $0 emergency-disable
    $0 list-backups --retention 30

Environment Variables:
    DB_HOST              Database host (default: localhost)
    DB_PORT              Database port (default: 5432)
    DB_USERNAME          Database username (default: postgres)
    DB_PASSWORD          Database password (default: postgres)
    DB_DATABASE          Database name (default: postgres)
    BACKUP_DIR           Backup directory (default: ./backups)
    GPG_RECIPIENT        GPG key for encryption
EOF
}

# Parse command line arguments
COMMAND=""
COMPRESS=false
ENCRYPT=false
DRY_RUN=false
RETENTION_DAYS=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        backup-full|backup-configs|backup-schemas|restore-full|restore-configs|list-backups|validate-backup|emergency-disable|emergency-restore)
            COMMAND="$1"
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --compress)
            COMPRESS=true
            shift
            ;;
        --encrypt)
            ENCRYPT=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            if [[ -z "$BACKUP_FILE" ]]; then
                BACKUP_FILE="$1"
            else
                log_error "Unknown option: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate dependencies
check_dependencies() {
    local missing_deps=()
    
    command -v psql >/dev/null 2>&1 || missing_deps+=("postgresql-client")
    command -v pg_dump >/dev/null 2>&1 || missing_deps+=("postgresql-client")
    
    if [[ "$COMPRESS" == true ]]; then
        command -v gzip >/dev/null 2>&1 || missing_deps+=("gzip")
    fi
    
    if [[ "$ENCRYPT" == true ]]; then
        command -v gpg >/dev/null 2>&1 || missing_deps+=("gnupg")
        if [[ -z "$GPG_RECIPIENT" ]]; then
            log_error "GPG_RECIPIENT environment variable required for encryption"
            exit 1
        fi
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Install with: apt-get install ${missing_deps[*]}"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would create backup directory: $BACKUP_DIR"
        return
    fi
    
    mkdir -p "$BACKUP_DIR"
    chmod 750 "$BACKUP_DIR"
    log_success "Created backup directory: $BACKUP_DIR"
}

# Test database connection
test_db_connection() {
    log_info "Testing database connection..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would test connection to ${DB_HOST}:${DB_PORT}"
        return
    fi
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -c "SELECT 1;" > /dev/null 2>&1
    
    if [[ $? -eq 0 ]]; then
        log_success "Database connection successful"
    else
        log_error "Database connection failed"
        exit 1
    fi
}

# Apply post-processing to backup file
process_backup_file() {
    local file="$1"
    local final_file="$file"
    
    if [[ "$COMPRESS" == true ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            log_info "Would compress: $file"
        else
            gzip "$file"
            final_file="${file}.gz"
            log_success "Compressed backup: $final_file"
        fi
    fi
    
    if [[ "$ENCRYPT" == true ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            log_info "Would encrypt for recipient: $GPG_RECIPIENT"
        else
            gpg --trust-model always --encrypt -r "$GPG_RECIPIENT" "$final_file"
            rm "$final_file"
            final_file="${final_file}.gpg"
            log_success "Encrypted backup: $final_file"
        fi
    fi
    
    echo "$final_file"
}

# Full database backup
backup_full() {
    log_info "Creating full database backup..."
    
    local backup_file="$BACKUP_DIR/full_backup_${TIMESTAMP}.sql"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would create full backup: $backup_file"
        return
    fi
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="$backup_file"
    
    if [[ $? -eq 0 ]]; then
        local final_file=$(process_backup_file "$backup_file")
        log_success "Full backup created: $final_file"
        
        # Create metadata file
        cat > "${final_file}.meta" << EOF
backup_type=full
timestamp=$TIMESTAMP
database=$DB_DATABASE
host=$DB_HOST
port=$DB_PORT
size=$(du -h "$final_file" | cut -f1)
compressed=$COMPRESS
encrypted=$ENCRYPT
EOF
    else
        log_error "Full backup failed"
        exit 1
    fi
}

# Game configurations backup
backup_configs() {
    log_info "Creating game configurations backup..."
    
    local backup_file="$BACKUP_DIR/game_configs_${TIMESTAMP}.sql"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would create config backup: $backup_file"
        return
    fi
    
    # Backup game configuration tables with data
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        --verbose \
        --no-password \
        --data-only \
        --table="games.game_configs" \
        --table="games.game_bet_limits" \
        --table="games.game_multipliers" \
        --file="$backup_file"
    
    if [[ $? -eq 0 ]]; then
        # Add configuration count to the backup
        {
            echo "-- Configuration Statistics"
            echo "-- Generated: $TIMESTAMP"
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -t -c "
                SELECT 
                    '-- Game Configs: ' || COUNT(*) 
                FROM games.game_configs 
                WHERE created_by = 'system';
            "
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -t -c "
                SELECT 
                    '-- Bet Limits: ' || COUNT(*) 
                FROM games.game_bet_limits 
                WHERE created_by = 'system';
            "
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -t -c "
                SELECT 
                    '-- Multipliers: ' || COUNT(*) 
                FROM games.game_multipliers 
                WHERE created_by = 'system';
            "
        } >> "$backup_file"
        
        local final_file=$(process_backup_file "$backup_file")
        log_success "Game configurations backup created: $final_file"
        
        # Create metadata file
        cat > "${final_file}.meta" << EOF
backup_type=configs
timestamp=$TIMESTAMP
database=$DB_DATABASE
host=$DB_HOST
port=$DB_PORT
size=$(du -h "$final_file" | cut -f1)
compressed=$COMPRESS
encrypted=$ENCRYPT
tables=games.game_configs,games.game_bet_limits,games.game_multipliers
EOF
    else
        log_error "Game configurations backup failed"
        exit 1
    fi
}

# Schema backup
backup_schemas() {
    log_info "Creating database schema backup..."
    
    local backup_file="$BACKUP_DIR/schemas_${TIMESTAMP}.sql"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would create schema backup: $backup_file"
        return
    fi
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        --verbose \
        --no-password \
        --schema-only \
        --schema="games" \
        --schema="admin" \
        --file="$backup_file"
    
    if [[ $? -eq 0 ]]; then
        local final_file=$(process_backup_file "$backup_file")
        log_success "Schema backup created: $final_file"
        
        # Create metadata file
        cat > "${final_file}.meta" << EOF
backup_type=schemas
timestamp=$TIMESTAMP
database=$DB_DATABASE
host=$DB_HOST
port=$DB_PORT
size=$(du -h "$final_file" | cut -f1)
compressed=$COMPRESS
encrypted=$ENCRYPT
schemas=games,admin
EOF
    else
        log_error "Schema backup failed"
        exit 1
    fi
}

# Decrypt and decompress file if needed
prepare_restore_file() {
    local file="$1"
    local temp_file="$file"
    
    # Decrypt if needed
    if [[ "$file" == *.gpg ]]; then
        log_info "Decrypting backup file..."
        temp_file="${file%.gpg}"
        gpg --decrypt "$file" > "$temp_file"
    fi
    
    # Decompress if needed
    if [[ "$temp_file" == *.gz ]]; then
        log_info "Decompressing backup file..."
        gunzip -c "$temp_file" > "${temp_file%.gz}"
        temp_file="${temp_file%.gz}"
    fi
    
    echo "$temp_file"
}

# Restore full database
restore_full() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file required for restore"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will restore the entire database from backup!"
    log_warning "Current data will be PERMANENTLY LOST!"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would restore from: $backup_file"
        return
    fi
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    log_info "Preparing restore file..."
    local restore_file=$(prepare_restore_file "$backup_file")
    
    log_info "Restoring database from: $restore_file"
    
    # Create a pre-restore backup
    log_info "Creating pre-restore backup..."
    backup_full
    
    # Restore database
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        --verbose \
        --clean \
        --if-exists \
        --no-password \
        "$restore_file"
    
    if [[ $? -eq 0 ]]; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed"
        exit 1
    fi
    
    # Clean up temporary files
    if [[ "$restore_file" != "$backup_file" ]]; then
        rm -f "$restore_file"
    fi
}

# Restore game configurations
restore_configs() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file required for restore"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will restore game configurations from backup!"
    log_warning "Current configurations will be overwritten!"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would restore configs from: $backup_file"
        return
    fi
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    log_info "Creating backup of current configurations..."
    backup_configs
    
    log_info "Preparing restore file..."
    local restore_file=$(prepare_restore_file "$backup_file")
    
    # Clear existing system configurations
    log_info "Clearing existing system configurations..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -c "
        DELETE FROM games.game_multipliers WHERE created_by = 'system';
        DELETE FROM games.game_bet_limits WHERE created_by = 'system';
        DELETE FROM games.game_configs WHERE created_by = 'system';
    "
    
    # Restore configurations
    log_info "Restoring configurations from: $restore_file"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -f "$restore_file"
    
    if [[ $? -eq 0 ]]; then
        log_success "Game configurations restored successfully"
        
        # Clear cache to force reload
        if command -v redis-cli >/dev/null 2>&1; then
            log_info "Clearing configuration cache..."
            redis-cli eval "
                for i, name in ipairs(redis.call('KEYS', 'game_config:*')) do
                  redis.call('DEL', name)
                end
                for i, name in ipairs(redis.call('KEYS', 'bet_limits:*')) do
                  redis.call('DEL', name)
                end
            " 0
            log_success "Cache cleared"
        fi
    else
        log_error "Configuration restore failed"
        exit 1
    fi
    
    # Clean up temporary files
    if [[ "$restore_file" != "$backup_file" ]]; then
        rm -f "$restore_file"
    fi
}

# List available backups
list_backups() {
    log_info "Available backups in: $BACKUP_DIR"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory does not exist: $BACKUP_DIR"
        return
    fi
    
    echo ""
    printf "%-20s %-15s %-10s %-20s %s\n" "TYPE" "DATE" "SIZE" "FILE" "ENCRYPTED"
    printf "%-20s %-15s %-10s %-20s %s\n" "----" "----" "----" "----" "---------"
    
    for meta_file in "$BACKUP_DIR"/*.meta; do
        if [[ -f "$meta_file" ]]; then
            source "$meta_file"
            local backup_file="${meta_file%.meta}"
            local encrypted_status=""
            
            if [[ "$encrypted" == "true" ]]; then
                encrypted_status="🔒 Yes"
            else
                encrypted_status="No"
            fi
            
            printf "%-20s %-15s %-10s %-20s %s\n" \
                "$backup_type" \
                "${timestamp:0:8}" \
                "$size" \
                "$(basename "$backup_file")" \
                "$encrypted_status"
        fi
    done
    
    # Clean up old backups if retention is specified
    if [[ -n "$RETENTION_DAYS" ]]; then
        log_info "Cleaning up backups older than $RETENTION_DAYS days..."
        
        if [[ "$DRY_RUN" == true ]]; then
            find "$BACKUP_DIR" -name "*.sql*" -mtime +$RETENTION_DAYS -print | while read file; do
                log_info "Would delete: $file"
            done
        else
            local deleted_count=$(find "$BACKUP_DIR" -name "*.sql*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
            local deleted_meta=$(find "$BACKUP_DIR" -name "*.meta" -mtime +$RETENTION_DAYS -delete -print | wc -l)
            log_success "Cleaned up $deleted_count backup files and $deleted_meta metadata files"
        fi
    fi
}

# Validate backup file
validate_backup() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file required for validation"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Validating backup file: $backup_file"
    
    # Check if file is encrypted
    if [[ "$backup_file" == *.gpg ]]; then
        log_info "File is encrypted, attempting to decrypt for validation..."
        if ! gpg --decrypt "$backup_file" > /dev/null 2>&1; then
            log_error "Failed to decrypt backup file"
            exit 1
        fi
        log_success "Encryption validation passed"
    fi
    
    # Check if file is compressed
    local test_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        log_info "File is compressed, testing compression integrity..."
        if ! gzip -t "$backup_file"; then
            log_error "Backup file compression is corrupted"
            exit 1
        fi
        log_success "Compression validation passed"
    fi
    
    # Test SQL syntax if it's a SQL file
    if [[ "$test_file" == *.sql ]] || [[ "$test_file" == *.sql.gz ]]; then
        local temp_file=$(prepare_restore_file "$backup_file")
        
        log_info "Validating SQL syntax..."
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" --set ON_ERROR_STOP=1 -f "$temp_file" --single-transaction --dry-run 2>/dev/null; then
            log_warning "SQL syntax validation failed or dry-run not supported"
        else
            log_success "SQL syntax validation passed"
        fi
        
        # Clean up temporary files
        if [[ "$temp_file" != "$backup_file" ]]; then
            rm -f "$temp_file"
        fi
    fi
    
    log_success "Backup file validation completed"
}

# Emergency disable all dynamic configurations
emergency_disable() {
    log_warning "EMERGENCY: Disabling all dynamic game configurations"
    log_warning "This will force the system to use hardcoded fallback values"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would disable all dynamic configurations"
        return
    fi
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Emergency disable cancelled by user"
        exit 0
    fi
    
    log_info "Creating emergency backup before disabling..."
    backup_configs
    
    log_info "Disabling all game configurations..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -c "
        UPDATE games.game_configs SET status = 'disabled' WHERE created_by = 'system';
        UPDATE games.game_bet_limits SET is_active = false WHERE created_by = 'system';
        UPDATE games.game_multipliers SET is_active = false WHERE created_by = 'system';
    "
    
    # Clear all configuration cache
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Clearing all configuration cache..."
        redis-cli eval "
            for i, name in ipairs(redis.call('KEYS', 'game_config:*')) do
              redis.call('DEL', name)
            end
            for i, name in ipairs(redis.call('KEYS', 'bet_limits:*')) do
              redis.call('DEL', name)
            end
            for i, name in ipairs(redis.call('KEYS', 'multipliers:*')) do
              redis.call('DEL', name)
            end
        " 0
        log_success "Cache cleared"
    fi
    
    log_success "Emergency disable completed"
    log_warning "System is now using hardcoded fallback configurations"
    log_info "To re-enable, use: restore-configs with a valid backup file"
}

# Emergency restore to safe state
emergency_restore() {
    log_warning "EMERGENCY: Restoring to safe fallback state"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would restore to safe state"
        return
    fi
    
    # Find the most recent config backup
    local latest_backup=$(find "$BACKUP_DIR" -name "game_configs_*.sql*" -type f | sort -r | head -n1)
    
    if [[ -z "$latest_backup" ]]; then
        log_warning "No configuration backup found, running emergency disable instead"
        emergency_disable
        return
    fi
    
    log_info "Found latest backup: $latest_backup"
    
    read -p "Restore from this backup? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Emergency restore cancelled by user"
        exit 0
    fi
    
    restore_configs "$latest_backup"
    
    log_success "Emergency restore completed"
}

# Main execution
main() {
    if [[ -z "$COMMAND" ]]; then
        log_error "No command specified"
        show_help
        exit 1
    fi
    
    check_dependencies
    create_backup_dir
    test_db_connection
    
    case "$COMMAND" in
        backup-full)
            backup_full
            ;;
        backup-configs)
            backup_configs
            ;;
        backup-schemas)
            backup_schemas
            ;;
        restore-full)
            restore_full "$BACKUP_FILE"
            ;;
        restore-configs)
            restore_configs "$BACKUP_FILE"
            ;;
        list-backups)
            list_backups
            ;;
        validate-backup)
            validate_backup "$BACKUP_FILE"
            ;;
        emergency-disable)
            emergency_disable
            ;;
        emergency-restore)
            emergency_restore
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Handle script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi