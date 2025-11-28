import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IntercomService {
  private readonly logger = new Logger(IntercomService.name);
  private readonly accessToken: string;
  private adminId: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('intercom.accessToken', { infer: true })!;
  }

  private async intercomFetch(pathname: string, init?: { method?: string; body?: unknown }) {
    const response = await fetch(`https://api.intercom.io${pathname}`, {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await response.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return { ok: response.ok, status: response.status, json, text };
  }

  private async fetchAdminId(): Promise<string | null> {
    const { ok, json } = await this.intercomFetch('/admins');
    if (!ok) return null;
    const id = json?.admins?.[0]?.id || json?.data?.[0]?.id;
    return id ? String(id) : null;
  }

  private async ensureAdminId(): Promise<string | null> {
    if (this.adminId) return this.adminId;
    this.adminId = await this.fetchAdminId();
    return this.adminId;
  }

  private async searchContactIdByExternalId(externalId: string): Promise<string | null> {
    const body = { query: { field: 'external_id', operator: '=', value: String(externalId) } };
    const { ok, json } = await this.intercomFetch('/contacts/search', { method: 'POST', body });
    if (!ok) return null;
    const id = json?.data?.[0]?.id;
    return id ? String(id) : null;
  }

  private async searchContactIdByUserId(userId: string): Promise<string | null> {
    const body = { query: { field: 'user_id', operator: '=', value: String(userId) } };
    const { ok, json } = await this.intercomFetch('/contacts/search', { method: 'POST', body });
    if (!ok) return null;
    const id = json?.data?.[0]?.id;
    return id ? String(id) : null;
  }

  private async updateContactExternalId(contactId: string, externalId: string): Promise<void> {
    await this.intercomFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: { external_id: String(externalId) },
    });
  }

  private async createContactWithExternalId(
    externalId: string,
    name?: string,
    email?: string,
  ): Promise<string | null> {
    const payload: any = { role: 'user', external_id: String(externalId) };
    if (name) payload.name = String(name);
    if (email) payload.email = String(email);
    const { ok, json } = await this.intercomFetch('/contacts', { method: 'POST', body: payload });
    if (!ok) return null;
    const id = json?.id;
    return id ? String(id) : null;
  }

  private async ensureContactId(externalId: string, name?: string, email?: string) {
    const byExternal = await this.searchContactIdByExternalId(externalId);
    if (byExternal) return byExternal;
    const byUser = await this.searchContactIdByUserId(externalId);
    if (byUser) {
      await this.updateContactExternalId(byUser, externalId);
      return byUser;
    }
    return this.createContactWithExternalId(externalId, name, email);
  }

  private conversationHasContact(conversation: any, contactId: string) {
    const contacts = conversation?.contacts;
    const list = contacts && (contacts.contacts || contacts.data || contacts);
    if (!Array.isArray(list)) return false;
    return list.some((c: any) => c && c.id === contactId);
  }

  private async listConversationsByContact(contactId: string): Promise<any[]> {
    const searchBody = {
      query: {
        operator: 'AND',
        value: [{ field: 'contacts.id', operator: '=', value: String(contactId) }],
      },
      sort: { field: 'updated_at', order: 'desc' },
    };
    const first = await this.intercomFetch('/conversations/search', {
      method: 'POST',
      body: searchBody,
    });
    if (first.ok) {
      const data = first.json?.conversations || first.json?.data || [];
      return Array.isArray(data) ? data : [];
    }
    const fallback = await this.intercomFetch(
      `/conversations?contact_id=${encodeURIComponent(contactId)}`,
    );
    if (!fallback.ok) return [];
    return Array.isArray(fallback.json?.conversations) ? fallback.json.conversations : [];
  }

  private async listConversationsByUserId(userId: string): Promise<any[]> {
    const { ok, json } = await this.intercomFetch(
      `/conversations?type=user&user_id=${encodeURIComponent(userId)}`,
    );
    if (!ok) return [];
    return Array.isArray(json?.conversations) ? json.conversations : [];
  }

  private async resolveLatestConversationId(
    userId: string,
    contactId: string,
  ): Promise<string | null> {
    for (let i = 0; i < 3; i++) {
      const byContact = await this.listConversationsByContact(contactId);
      if (byContact && byContact.length) {
        const openFirst = byContact
          .filter((c: any) => (c.state || c.open ? c.state === 'open' || c.open === true : true))
          .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0));
        const pick = openFirst[0] || byContact[0];
        if (pick && this.conversationHasContact(pick, contactId)) return pick.id || null;
      }
      const byUser = await this.listConversationsByUserId(userId);
      const filtered = (byUser || []).filter((c: any) => this.conversationHasContact(c, contactId));
      if (filtered.length) {
        filtered.sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0));
        return filtered[0]?.id || null;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }
  private async replyToConversation(conversationId: string, bodyText: string): Promise<void> {
    const id = await this.ensureAdminId();
    if (!id) throw new Error('Intercom admin id unavailable');
    const payload = {
      type: 'admin',
      admin_id: id,
      message_type: 'comment',
      body: String(bodyText),
    };
    const { ok, status, text } = await this.intercomFetch(
      `/conversations/${conversationId}/reply`,
      {
        method: 'POST',
        body: payload,
      },
    );
    if (!ok) {
      throw new Error(`intercom conversations.reply ${status}: ${text}`);
    }
  }

  private async sendAdminMessage(contactId: string, bodyText: string): Promise<void> {
    const id = await this.ensureAdminId();
    if (!id) throw new Error('Intercom admin id unavailable');
    const payload = {
      message_type: 'inapp',
      body: String(bodyText),
      from: { type: 'admin', id },
      to: { type: 'user', id: contactId },
    } as const;
    const { ok, status, text } = await this.intercomFetch('/messages', {
      method: 'POST',
      body: payload,
    });
    if (!ok) throw new Error(`intercom messages ${status}: ${text}`);
  }

  async sendMessageToUser(
    userId: string,
    message: string,
    name?: string,
    email?: string,
  ): Promise<void> {
    // ensure contact exists
    const contactId = await this.ensureContactId(String(userId), name, email);
    if (!contactId) {
      this.logger.error(`Intercom: could not find or create contact ${userId}`);
      return;
    }
    // try to reuse existing conversation thread
    const convId = await this.resolveLatestConversationId(String(userId), contactId);
    if (convId) {
      // reply in existing thread
      await this.replyToConversation(convId, message);
    } else {
      // send new in-app message (creates thread)
      await this.sendAdminMessage(contactId, message);
    }
  }
}
